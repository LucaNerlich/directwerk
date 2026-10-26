package de.pnnit.directwerk.modules.core.content;

import de.pnnit.directwerk.modules.content.ContentPublishedNotifier;
import de.pnnit.directwerk.modules.content.ContentType;
import de.pnnit.directwerk.modules.content.InvalidPublicationTransitionException;
import de.pnnit.directwerk.modules.content.PublicationLifecycleSupport;
import de.pnnit.directwerk.modules.content.PublicationTransitions;
import de.pnnit.directwerk.modules.content.ScheduledPublishing;
import de.pnnit.directwerk.modules.core.authorization.ContentEntityType;
import de.pnnit.directwerk.modules.core.authorization.ContentOperation;
import de.pnnit.directwerk.modules.core.notification.PublicationNotificationSupport;
import de.pnnit.directwerk.modules.core.notification.SubscriberNotificationGate;
import de.pnnit.directwerk.modules.core.service.MembershipPermissionService;
import de.pnnit.directwerk.modules.core.service.ScheduledPublicationExecutor;
import java.time.Instant;
import java.util.List;
import java.util.function.BiConsumer;
import lombok.extern.slf4j.Slf4j;

/**
 * The publication lifecycle shared by every content type: publish, schedule,
 * cancel, unpublish, archive, unarchive, bulk transitions and the scheduled
 * publish worker.
 *
 * <p>The orchestration — transition guards, published-at resolution, the single
 * feed refresh per batch, the notification claim, the scheduled-publish permission
 * skip — lives here exactly once. A vertical service keeps only its hooks: how to
 * load and save its entity, which status enum value means which {@link Phase},
 * what must be validated before publishing, and which module/content labels the
 * error messages and feeds use.</p>
 *
 * @param <ENTITY> the module's publishable entity
 * @param <STATUS> the module's lifecycle enum
 */
@Slf4j
public abstract class PublicationWorkflow<ENTITY extends PublicationEntity<STATUS>, STATUS> {

    /**
     * The lifecycle phase every content type shares, mapped from the module status enum.
     */
    protected enum Phase {
        DRAFT,
        SCHEDULED,
        PUBLISHED,
        ARCHIVED
    }

    private final ScheduledPublicationExecutor scheduledPublicationExecutor;
    private final ContentPublishedNotifier contentPublishedNotifier;
    private final SubscriberNotificationGate notificationGate;
    protected final MembershipPermissionService permissionService;

    protected PublicationWorkflow(
            ScheduledPublicationExecutor scheduledPublicationExecutor,
            ContentPublishedNotifier contentPublishedNotifier,
            SubscriberNotificationGate notificationGate,
            MembershipPermissionService permissionService
    ) {
        this.scheduledPublicationExecutor = scheduledPublicationExecutor;
        this.contentPublishedNotifier = contentPublishedNotifier;
        this.notificationGate = notificationGate;
        this.permissionService = permissionService;
    }

    /**
     * Publishes one entity with a feed refresh.
     */
    protected ENTITY publishContent(
            Long tenantId,
            Long contentId,
            boolean notifySubscribers,
            Instant publishedAt
    ) {
        ENTITY entity = requireEntity(tenantId, contentId);
        requirePermission(ContentOperation.PUBLISH, entity);
        return publishInternal(tenantId, entity, notifySubscribers, publishedAt, true);
    }

    /**
     * Schedules one draft entity.
     */
    protected ENTITY scheduleContent(
            Long tenantId,
            Long contentId,
            Instant scheduledAt,
            boolean notifySubscribers
    ) {
        ENTITY entity = requireEntity(tenantId, contentId);
        requirePermission(ContentOperation.SCHEDULE, entity);
        beforeSchedule(entity);
        PublicationLifecycleSupport.schedule(
                scheduledAt,
                () -> phaseOf(entity.getStatus()) == Phase.DRAFT,
                pluralLabel(),
                () -> {
                    entity.setStatus(statusFor(Phase.SCHEDULED));
                    entity.setScheduledAt(scheduledAt);
                    entity.setNotifySubscribersOnPublish(notifySubscribers);
                }
        );
        return save(entity);
    }

    /**
     * Cancels a scheduled entity and returns it to draft.
     */
    protected ENTITY cancelScheduleContent(Long tenantId, Long contentId) {
        ENTITY entity = requireEntity(tenantId, contentId);
        requirePermission(ContentOperation.SCHEDULE, entity);
        PublicationLifecycleSupport.cancelSchedule(
                () -> phaseOf(entity.getStatus()) == Phase.SCHEDULED,
                pluralLabel(),
                () -> {
                    entity.setStatus(statusFor(Phase.DRAFT));
                    entity.setScheduledAt(null);
                }
        );
        return save(entity);
    }

    /**
     * Returns a published entity to draft. When {@code refresh} is false the caller is
     * responsible for the single feed refresh of the enclosing batch.
     */
    protected ENTITY unpublishContent(Long tenantId, Long contentId, boolean refresh) {
        ENTITY entity = requireEntity(tenantId, contentId);
        requirePermission(ContentOperation.UNPUBLISH, entity);
        unpublishInternal(tenantId, entity, refresh);
        return save(entity);
    }

    /**
     * Archives a published entity and refreshes its feed.
     */
    protected ENTITY archiveContent(Long tenantId, Long contentId) {
        ENTITY entity = requireEntity(tenantId, contentId);
        requirePermission(ContentOperation.ARCHIVE, entity);
        PublicationLifecycleSupport.archive(
                () -> phaseOf(entity.getStatus()) == Phase.PUBLISHED,
                pluralLabel(),
                () -> {
                    beforeArchive(entity);
                    entity.setStatus(statusFor(Phase.ARCHIVED));
                    entity.setScheduledAt(null);
                },
                null
        );
        ENTITY archived = save(entity);
        requestFeedRefresh(tenantId);
        return archived;
    }

    /**
     * Returns an archived entity to draft.
     */
    protected ENTITY unarchiveContent(Long tenantId, Long contentId) {
        ENTITY entity = requireEntity(tenantId, contentId);
        requirePermission(ContentOperation.UNARCHIVE, entity);
        PublicationLifecycleSupport.unarchive(
                () -> phaseOf(entity.getStatus()) == Phase.ARCHIVED,
                pluralLabel(),
                () -> {
                    entity.setStatus(statusFor(Phase.DRAFT));
                    entity.setPublishedAt(null);
                    entity.setScheduledAt(null);
                }
        );
        return save(entity);
    }

    /**
     * Publishes every id in one transaction and refreshes the feed once.
     */
    protected List<ENTITY> bulkPublishContent(
            Long tenantId,
            List<Long> contentIds,
            boolean notifySubscribers,
            Instant publishedAt
    ) {
        List<ENTITY> published = BulkPublication.apply(contentIds, contentId -> {
            ENTITY entity = requireEntity(tenantId, contentId);
            requirePermission(ContentOperation.PUBLISH, entity);
            return publishInternal(tenantId, entity, notifySubscribers, publishedAt, false);
        });
        requestFeedRefresh(tenantId);
        return published;
    }

    /**
     * Unpublishes every id in one transaction and refreshes the feed once.
     */
    protected List<ENTITY> bulkUnpublishContent(Long tenantId, List<Long> contentIds) {
        List<ENTITY> unpublished = BulkPublication.apply(contentIds, contentId -> {
            ENTITY entity = requireEntity(tenantId, contentId);
            requirePermission(ContentOperation.UNPUBLISH, entity);
            unpublishInternal(tenantId, entity, false);
            return save(entity);
        });
        requestFeedRefresh(tenantId);
        return unpublished;
    }

    /**
     * Publishes one entity that the scheduled worker found due.
     */
    protected void publishScheduledContent(Long tenantId, Long contentId) {
        ENTITY entity = requireEntity(tenantId, contentId);
        if (PublicationLifecycleSupport.skipScheduledPublishIfStatusChanged(
                phaseOf(entity.getStatus()) == Phase.SCHEDULED,
                log,
                singularLabel(),
                contentId,
                tenantId,
                entity.getStatus()
        )) {
            return;
        }
        if (permissionService.isDeniedForOwner(
                tenantId, entity.getCreatedBy(), entityType(), ContentOperation.PUBLISH)) {
            log.warn(
                    "Skipping scheduled publish for {} {} (tenant {}): PUBLISH is restricted for creator {}",
                    singularLabel(), contentId, tenantId, entity.getCreatedBy());
            return;
        }
        publishInternal(tenantId, entity, entity.isNotifySubscribersOnPublish(), null, true);
    }

    /**
     * Publishes every due scheduled entity through the module's transactional entry point.
     *
     * @return the number of entities published
     */
    protected int publishDueScheduledContent() {
        List<ScheduledPublishing.DueItem> dueItems = findDueScheduled(Instant.now()).stream()
                .map(entity -> new ScheduledPublishing.DueItem(entity.getTenant().getId(), entity.getId()))
                .toList();
        return scheduledPublicationExecutor.publishDue(
                moduleKey(),
                dueItems,
                scheduledPublisher(),
                pluralLabel()
        );
    }

    private ENTITY publishInternal(
            Long tenantId,
            ENTITY entity,
            boolean notifySubscribers,
            Instant requestedPublishedAt,
            boolean refresh
    ) {
        PublicationTransitions.requireDraftOrScheduled(
                phaseOf(entity.getStatus()) == Phase.DRAFT
                        || phaseOf(entity.getStatus()) == Phase.SCHEDULED,
                pluralLabel());
        validateAndPrepareForPublish(tenantId, entity);

        Instant publishedAt = PublicationTransitions.resolvePublishedAt(
                requestedPublishedAt,
                entity.getPublishedAt()
        );
        entity.setStatus(statusFor(Phase.PUBLISHED));
        entity.setPublishedAt(publishedAt);
        entity.setScheduledAt(null);
        ENTITY published = save(entity);

        if (refresh) {
            requestFeedRefresh(tenantId);
        }
        maybeNotifySubscribers(tenantId, published, notifySubscribers);
        return published;
    }

    private void unpublishInternal(Long tenantId, ENTITY entity, boolean refresh) {
        PublicationLifecycleSupport.unpublish(
                () -> phaseOf(entity.getStatus()) == Phase.PUBLISHED,
                pluralLabel(),
                () -> {
                    beforeUnpublish(entity);
                    entity.setStatus(statusFor(Phase.DRAFT));
                    entity.setPublishedAt(null);
                    entity.setScheduledAt(null);
                },
                refresh ? () -> requestFeedRefresh(tenantId) : null
        );
    }

    private void maybeNotifySubscribers(Long tenantId, ENTITY published, boolean notifySubscribers) {
        Instant notifiedAt = Instant.now();
        PublicationNotificationSupport.maybeNotify(
                tenantId,
                contentType(),
                published.getId(),
                published.getTitle(),
                notificationExcerpt(published),
                published.getSlug(),
                accessPolicyName(published),
                shouldNotify(published, notifySubscribers),
                notificationGate,
                contentPublishedNotifier,
                () -> claimEmailNotification(tenantId, published.getId(), notifiedAt),
                () -> published.setEmailNotifiedAt(notifiedAt)
        );
    }

    /**
     * Re-enqueues subscriber notification for an already-published item (studio failure recovery
     * or first send when publish skipped notify). Clears the one-shot claim so fan-out can run;
     * per-recipient markers still suppress duplicate addresses.
     */
    protected ENTITY notifyContentNow(Long tenantId, Long contentId) {
        ENTITY entity = requireEntity(tenantId, contentId);
        requirePermission(ContentOperation.PUBLISH, entity);
        if (phaseOf(entity.getStatus()) != Phase.PUBLISHED) {
            throw new InvalidPublicationTransitionException(
                    "Only PUBLISHED " + pluralLabel() + " can send subscriber notifications");
        }
        if (!notificationGate.enabled(tenantId, contentType(), contentId)) {
            throw new InvalidPublicationTransitionException(
                    "Subscriber notifications are not available for this tenant");
        }
        if (!shouldNotify(entity, true)) {
            throw new InvalidPublicationTransitionException(
                    "No notification audience for this " + singularLabel());
        }
        clearEmailNotification(tenantId, contentId);
        entity.setEmailNotifiedAt(null);
        maybeNotifySubscribers(tenantId, entity, true);
        return save(entity);
    }

    /** Loads the entity or throws the module's not-found exception. */
    protected abstract ENTITY requireEntity(Long tenantId, Long contentId);

    /** Persists the entity through the module repository. */
    protected abstract ENTITY save(ENTITY entity);

    /** Finds the module's entities whose scheduled time has passed. */
    protected abstract List<ENTITY> findDueScheduled(Instant now);

    /** Maps the module status enum onto the shared lifecycle phase. */
    protected abstract Phase phaseOf(STATUS status);

    /** Maps a shared lifecycle phase onto the module status enum. */
    protected abstract STATUS statusFor(Phase phase);

    /** Enforces the module's per-entity permission check. */
    protected abstract void requirePermission(ContentOperation operation, ENTITY entity);

    /** Validates and sanitizes the entity for publishing, throwing the module's validation exception. */
    protected abstract void validateAndPrepareForPublish(Long tenantId, ENTITY entity);

    /** Module-specific schedule precondition; no-op by default. */
    protected void beforeSchedule(ENTITY entity) {
        // no-op
    }

    /** Module-specific unpublish side effect, such as demoting a public media asset. */
    protected void beforeUnpublish(ENTITY entity) {
        // no-op
    }

    /** Module-specific archive side effect, such as demoting a public media asset. */
    protected void beforeArchive(ENTITY entity) {
        // no-op
    }

    /** The excerpt passed to the subscriber notification. */
    protected abstract String notificationExcerpt(ENTITY entity);

    /** Whether this publish should notify subscribers at all. */
    protected abstract boolean shouldNotify(ENTITY entity, boolean notifySubscribers);

    /** The access-policy name carried by the notification event. */
    protected abstract String accessPolicyName(ENTITY entity);

    /**
     * Claims the one-shot notification marker for this entity.
     *
     * @return the number of rows claimed
     */
    protected abstract int claimEmailNotification(Long tenantId, Long contentId, Instant notifiedAt);

    /** Clears {@code email_notified_at} so {@link #notifyContentNow} can reclaim. */
    protected abstract void clearEmailNotification(Long tenantId, Long contentId);

    /** Requests one feed refresh after commit. */
    protected abstract void requestFeedRefresh(Long tenantId);

    /** The module key gating the scheduled publish worker. */
    protected abstract String moduleKey();

    /** The plural content label used in transition errors and logs. */
    protected abstract String pluralLabel();

    /** The singular content label used in scheduled-publish logs. */
    protected abstract String singularLabel();

    /** The content type carried by the notification event. */
    protected abstract ContentType contentType();

    /** The entity type used by the permission service. */
    protected abstract ContentEntityType entityType();

    /** The module's transactional scheduled-publish entry point, through its proxy. */
    protected abstract BiConsumer<Long, Long> scheduledPublisher();
}
