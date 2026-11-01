package de.pnnit.directwerk.modules.podcast.service;

import de.pnnit.directwerk.modules.content.ContentPublishedNotifier;
import de.pnnit.directwerk.modules.content.ContentType;
import de.pnnit.directwerk.modules.content.PublicationTexts;
import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.core.authorization.ContentEntityType;
import de.pnnit.directwerk.modules.core.authorization.ContentOperation;
import de.pnnit.directwerk.modules.core.content.PublicationWorkflow;
import de.pnnit.directwerk.modules.core.notification.SubscriberNotificationGate;
import de.pnnit.directwerk.modules.core.service.MembershipPermissionService;
import de.pnnit.directwerk.modules.core.service.ScheduledPublicationExecutor;
import de.pnnit.directwerk.modules.digital.api.EpisodeMediaApi;
import de.pnnit.directwerk.modules.digital.entity.AccessPolicy;
import de.pnnit.directwerk.modules.digital.entity.AssetVisibility;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.digital.service.HtmlSanitizer;
import de.pnnit.directwerk.modules.podcast.PodcastModule;
import de.pnnit.directwerk.modules.podcast.entity.Episode;
import de.pnnit.directwerk.modules.podcast.entity.EpisodeStatus;
import de.pnnit.directwerk.modules.podcast.entity.SeriesStatus;
import de.pnnit.directwerk.modules.podcast.exception.EpisodeValidationException;
import de.pnnit.directwerk.modules.podcast.job.RssFeedRefreshJobProducer;
import de.pnnit.directwerk.modules.podcast.repository.EpisodeRepository;
import de.pnnit.directwerk.modules.search.SearchIndex;
import java.time.Instant;
import java.util.List;
import java.util.function.BiConsumer;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Podcast binding of {@link PublicationWorkflow}: episode loading, publish
 * validation (series, title, audio, formats), public-audio promotion/demotion
 * and the podcast feed refresh.
 */
@Service
public class PublicationWorkflowService extends PublicationWorkflow<Episode, EpisodeStatus> {

    private final EpisodeRepository episodeRepository;
    private final EpisodeService episodeService;
    private final FormatService formatService;
    private final EpisodeMediaApi episodeMediaApi;
    private final HtmlSanitizer htmlSanitizer;
    private final RssFeedRefreshJobProducer rssFeedRefreshScheduler;
    private final ObjectProvider<PublicationWorkflowService> self;
    private final SearchIndex searchIndex;

    public PublicationWorkflowService(
            EpisodeRepository episodeRepository,
            EpisodeService episodeService,
            FormatService formatService,
            EpisodeMediaApi episodeMediaApi,
            HtmlSanitizer htmlSanitizer,
            ScheduledPublicationExecutor scheduledPublicationExecutor,
            ContentPublishedNotifier contentPublishedNotifier,
            SubscriberNotificationGate notificationGate,
            RssFeedRefreshJobProducer rssFeedRefreshScheduler,
            ObjectProvider<PublicationWorkflowService> self,
            MembershipPermissionService permissionService,
            SearchIndex searchIndex
    ) {
        super(scheduledPublicationExecutor, contentPublishedNotifier, notificationGate, permissionService);
        this.searchIndex = searchIndex;
        this.episodeRepository = episodeRepository;
        this.episodeService = episodeService;
        this.formatService = formatService;
        this.episodeMediaApi = episodeMediaApi;
        this.htmlSanitizer = htmlSanitizer;
        this.rssFeedRefreshScheduler = rssFeedRefreshScheduler;
        this.self = self;
    }

    @Transactional
    @RequiresModule(PodcastModule.KEY)
    public Episode publish(Long tenantId, Long episodeId) {
        return publish(tenantId, episodeId, false);
    }

    @Transactional
    @RequiresModule(PodcastModule.KEY)
    public Episode publish(Long tenantId, Long episodeId, boolean notifySubscribers) {
        return publish(tenantId, episodeId, notifySubscribers, null);
    }

    @Transactional
    @RequiresModule(PodcastModule.KEY)
    public Episode publish(
            Long tenantId,
            Long episodeId,
            boolean notifySubscribers,
            Instant publishedAt
    ) {
        Episode episode = publishContent(tenantId, episodeId, notifySubscribers, publishedAt);
        EpisodeSearchIndex.mirror(searchIndex, episode);
        return episode;
    }

    @Transactional
    @RequiresModule(PodcastModule.KEY)
    public Episode schedule(Long tenantId, Long episodeId, Instant scheduledAt) {
        return schedule(tenantId, episodeId, scheduledAt, false);
    }

    @Transactional
    @RequiresModule(PodcastModule.KEY)
    public Episode schedule(Long tenantId, Long episodeId, Instant scheduledAt, boolean notifySubscribers) {
        return scheduleContent(tenantId, episodeId, scheduledAt, notifySubscribers);
    }

    @Transactional
    @RequiresModule(PodcastModule.KEY)
    public Episode cancelSchedule(Long tenantId, Long episodeId) {
        return cancelScheduleContent(tenantId, episodeId);
    }

    @Transactional
    @RequiresModule(PodcastModule.KEY)
    public Episode unpublish(Long tenantId, Long episodeId) {
        Episode episode = unpublishContent(tenantId, episodeId, true);
        EpisodeSearchIndex.mirror(searchIndex, episode);
        return episode;
    }

    @Transactional
    @RequiresModule(PodcastModule.KEY)
    public Episode archive(Long tenantId, Long episodeId) {
        Episode episode = archiveContent(tenantId, episodeId);
        EpisodeSearchIndex.mirror(searchIndex, episode);
        return episode;
    }

    @Transactional
    @RequiresModule(PodcastModule.KEY)
    public Episode unarchive(Long tenantId, Long episodeId) {
        Episode episode = unarchiveContent(tenantId, episodeId);
        EpisodeSearchIndex.mirror(searchIndex, episode);
        return episode;
    }

    @Transactional
    @RequiresModule(PodcastModule.KEY)
    public Episode discardWorkingDraft(Long tenantId, Long episodeId) {
        return discardWorkingDraftContent(tenantId, episodeId);
    }

    public int publishDueScheduled() {
        return publishDueScheduledContent();
    }

    @Transactional
    @RequiresModule(PodcastModule.KEY)
    public void publishScheduledEpisode(Long tenantId, Long episodeId) {
        publishScheduledContent(tenantId, episodeId);
        episodeRepository.findById(episodeId).ifPresent(episode -> EpisodeSearchIndex.mirror(searchIndex, episode));
    }

    /**
     * Publishes every id in a single transaction with a single RSS refresh.
     * The call is atomic: the first failure (unknown id, wrong status,
     * validation) rolls back all changes and surfaces that item's error.
     */
    @Transactional
    @RequiresModule(PodcastModule.KEY)
    public List<Episode> bulkPublish(
            Long tenantId,
            List<Long> episodeIds,
            boolean notifySubscribers,
            Instant publishedAt
    ) {
        List<Episode> published = bulkPublishContent(tenantId, episodeIds, notifySubscribers, publishedAt);
        published.forEach(episode -> EpisodeSearchIndex.mirror(searchIndex, episode));
        return published;
    }

    /**
     * Unpublishes every id in a single transaction with a single RSS refresh.
     * Atomic like {@link #bulkPublish(Long, List, boolean, Instant)}.
     */
    @Transactional
    @RequiresModule(PodcastModule.KEY)
    public List<Episode> bulkUnpublish(Long tenantId, List<Long> episodeIds) {
        List<Episode> unpublished = bulkUnpublishContent(tenantId, episodeIds);
        unpublished.forEach(episode -> EpisodeSearchIndex.mirror(searchIndex, episode));
        return unpublished;
    }

    @Override
    protected Episode requireEntity(Long tenantId, Long contentId) {
        return episodeService.requireEpisode(tenantId, contentId);
    }

    @Override
    protected Episode save(Episode entity) {
        return episodeRepository.save(entity);
    }

    @Override
    protected List<Episode> findDueScheduled(Instant now) {
        return episodeRepository.findByStatusAndScheduledAtLessThanEqualOrderByScheduledAtAscIdAsc(
                EpisodeStatus.SCHEDULED,
                now
        );
    }

    @Override
    protected Phase phaseOf(EpisodeStatus status) {
        return switch (status) {
            case DRAFT -> Phase.DRAFT;
            case SCHEDULED -> Phase.SCHEDULED;
            case PUBLISHED -> Phase.PUBLISHED;
            case ARCHIVED -> Phase.ARCHIVED;
        };
    }

    @Override
    protected EpisodeStatus statusFor(Phase phase) {
        return switch (phase) {
            case DRAFT -> EpisodeStatus.DRAFT;
            case SCHEDULED -> EpisodeStatus.SCHEDULED;
            case PUBLISHED -> EpisodeStatus.PUBLISHED;
            case ARCHIVED -> EpisodeStatus.ARCHIVED;
        };
    }

    @Override
    protected void requirePermission(ContentOperation operation, Episode episode) {
        permissionService.requireEpisodeAccess(operation, episode.getCreatedBy());
    }

    @Override
    protected void applyWorkingDraft(Long tenantId, Episode episode) {
        episodeService.applyWorkingDraft(tenantId, episode);
    }

    @Override
    protected void validateAndPrepareForPublish(Long tenantId, Episode episode) {
        requirePublishedSeries(episode);
        if (episode.getTitle() == null || episode.getTitle().isBlank()) {
            throw new EpisodeValidationException("Episode title is required");
        }

        String sanitizedDescription = htmlSanitizer.sanitize(episode.getDescription());
        episode.setDescription(sanitizedDescription);

        MediaAsset audioAsset = episode.getAudioAsset();
        if (audioAsset == null || audioAsset.getId() == null) {
            throw new EpisodeValidationException("Episode audio asset is required");
        }
        MediaAsset readyAudio = episodeMediaApi.requireReadyAudio(audioAsset.getId());

        if (formatService.hasActiveFormats(tenantId) && episode.getFormats().isEmpty()) {
            throw new EpisodeValidationException("At least one format is required before publishing");
        }
        if (episode.getFormats().stream().anyMatch(format -> !format.isActive())) {
            throw new EpisodeValidationException(
                    "Episode has a deactivated format assigned; update formats before publishing");
        }

        episodeMediaApi.attachEpisode(readyAudio.getId(), episode.getId());
        if (episode.getAccessPolicy() == AccessPolicy.FREE) {
            MediaAsset publicAudio = episodeMediaApi.promoteToPublic(readyAudio.getId());
            episode.setAudioAsset(publicAudio);
        } else if (readyAudio.getVisibility() == AssetVisibility.PUBLIC) {
            // Over-publish FREE→PAID (or PAID with a still-public asset) must demote;
            // unpublish used to be the only path that called demoteToPrivate.
            episode.setAudioAsset(episodeMediaApi.demoteToPrivate(readyAudio.getId()));
        } else {
            episode.setAudioAsset(readyAudio);
        }
    }

    @Override
    protected void beforeSchedule(Episode episode) {
        requirePublishedSeries(episode);
    }

    /**
     * Episodes of a draft series are invisible in every feed (public and private snapshots only
     * include published series), so publishing them would silently do nothing. Reject it up
     * front so authors see the actual blocker instead of a stale feed.
     */
    private static void requirePublishedSeries(Episode episode) {
        if (episode.getSeries() == null || episode.getSeries().getStatus() != SeriesStatus.PUBLISHED) {
            throw new EpisodeValidationException(
                    "Publish the series before publishing its episodes"
            );
        }
    }

    @Override
    protected void beforeUnpublish(Episode episode) {
        demotePublicAudioIfNeeded(episode);
    }

    @Override
    protected void beforeArchive(Episode episode) {
        demotePublicAudioIfNeeded(episode);
    }

    private void demotePublicAudioIfNeeded(Episode episode) {
        MediaAsset audioAsset = episode.getAudioAsset();
        if (audioAsset != null && audioAsset.getId() != null && audioAsset.getVisibility() == AssetVisibility.PUBLIC) {
            episode.setAudioAsset(episodeMediaApi.demoteToPrivate(audioAsset.getId()));
        }
    }

    @Override
    protected String notificationExcerpt(Episode episode) {
        return PublicationTexts.htmlExcerpt(episode.getDescription());
    }

    @Override
    protected boolean shouldNotify(Episode episode, boolean notifySubscribers) {
        return notifySubscribers;
    }

    @Override
    protected String accessPolicyName(Episode episode) {
        return episode.getAccessPolicy().name();
    }

    @Transactional
    @RequiresModule(PodcastModule.KEY)
    public Episode notifySubscribersNow(Long tenantId, Long episodeId) {
        return notifyContentNow(tenantId, episodeId);
    }

    @Override
    protected int claimEmailNotification(Long tenantId, Long contentId, Instant notifiedAt) {
        return episodeRepository.claimEmailNotification(tenantId, contentId, notifiedAt);
    }

    @Override
    protected void clearEmailNotification(Long tenantId, Long contentId) {
        episodeRepository.clearEmailNotification(tenantId, contentId);
    }

    @Override
    protected void requestFeedRefresh(Long tenantId) {
        rssFeedRefreshScheduler.requestRefreshAfterCommit(tenantId);
    }

    @Override
    protected String moduleKey() {
        return PodcastModule.KEY;
    }

    @Override
    protected String pluralLabel() {
        return "episodes";
    }

    @Override
    protected String singularLabel() {
        return "episode";
    }

    @Override
    protected ContentType contentType() {
        return ContentType.EPISODE;
    }

    @Override
    protected ContentEntityType entityType() {
        return ContentEntityType.EPISODE;
    }

    @Override
    protected BiConsumer<Long, Long> scheduledPublisher() {
        return self.getObject()::publishScheduledEpisode;
    }
}
