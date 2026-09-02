package de.pnnit.directwerk.modules.podcast.service;

import de.pnnit.directwerk.modules.content.PublicationLifecycleSupport;
import de.pnnit.directwerk.modules.core.notification.PublicationNotificationSupport;
import de.pnnit.directwerk.modules.content.PublicationTexts;
import de.pnnit.directwerk.modules.content.ScheduledPublishing.DueItem;
import de.pnnit.directwerk.modules.content.ContentPublishedNotifier;
import de.pnnit.directwerk.modules.content.ContentType;
import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.core.notification.SubscriberNotificationGate;
import de.pnnit.directwerk.modules.core.service.ScheduledPublicationExecutor;
import de.pnnit.directwerk.modules.digital.api.EpisodeMediaApi;
import de.pnnit.directwerk.modules.digital.entity.AssetVisibility;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.podcast.PodcastModule;
import de.pnnit.directwerk.modules.digital.entity.AccessPolicy;
import de.pnnit.directwerk.modules.podcast.entity.Episode;
import de.pnnit.directwerk.modules.podcast.entity.EpisodeStatus;
import de.pnnit.directwerk.modules.podcast.entity.SeriesStatus;
import de.pnnit.directwerk.modules.podcast.exception.EpisodeValidationException;
import de.pnnit.directwerk.modules.content.PublicationTransitions;
import de.pnnit.directwerk.modules.digital.service.HtmlSanitizer;
import de.pnnit.directwerk.modules.podcast.repository.EpisodeRepository;
import java.time.Instant;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class PublicationWorkflowService {

    private final EpisodeRepository episodeRepository;
    private final EpisodeService episodeService;
    private final FormatService formatService;
    private final EpisodeMediaApi episodeMediaApi;
    private final HtmlSanitizer htmlSanitizer;
    private final ScheduledPublicationExecutor scheduledPublicationExecutor;
    private final ContentPublishedNotifier contentPublishedNotifier;
    private final SubscriberNotificationGate notificationGate;
    private final RssFeedRefreshScheduler rssFeedRefreshScheduler;
    private final ObjectProvider<PublicationWorkflowService> self;

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
        Episode episode = episodeService.requireEpisode(tenantId, episodeId);
        return publishInternal(tenantId, episode, notifySubscribers, publishedAt);
    }

    @Transactional
    @RequiresModule(PodcastModule.KEY)
    public Episode schedule(Long tenantId, Long episodeId, Instant scheduledAt) {
        return schedule(tenantId, episodeId, scheduledAt, false);
    }

    @Transactional
    @RequiresModule(PodcastModule.KEY)
    public Episode schedule(Long tenantId, Long episodeId, Instant scheduledAt, boolean notifySubscribers) {
        Episode episode = episodeService.requireEpisode(tenantId, episodeId);
        requirePublishedSeries(episode);
        PublicationLifecycleSupport.schedule(
                scheduledAt,
                notifySubscribers,
                () -> episode.getStatus() == EpisodeStatus.DRAFT,
                "episodes",
                () -> {
                    episode.setStatus(EpisodeStatus.SCHEDULED);
                    episode.setScheduledAt(scheduledAt);
                    episode.setNotifySubscribersOnPublish(notifySubscribers);
                }
        );
        return episodeRepository.save(episode);
    }

    @Transactional
    @RequiresModule(PodcastModule.KEY)
    public Episode cancelSchedule(Long tenantId, Long episodeId) {
        Episode episode = episodeService.requireEpisode(tenantId, episodeId);
        PublicationTransitions.requireScheduledStatus(episode.getStatus() == EpisodeStatus.SCHEDULED, "episodes");
        episode.setStatus(EpisodeStatus.DRAFT);
        episode.setScheduledAt(null);
        return episodeRepository.save(episode);
    }

    @Transactional
    @RequiresModule(PodcastModule.KEY)
    public Episode unpublish(Long tenantId, Long episodeId) {
        Episode episode = episodeService.requireEpisode(tenantId, episodeId);
        PublicationLifecycleSupport.unpublish(
                () -> episode.getStatus() == EpisodeStatus.PUBLISHED,
                "episodes",
                () -> {
                    demotePublicAudioIfNeeded(episode);
                    episode.setStatus(EpisodeStatus.DRAFT);
                    episode.setPublishedAt(null);
                    episode.setScheduledAt(null);
                },
                () -> rssFeedRefreshScheduler.requestRefreshAfterCommit(tenantId)
        );
        return episodeRepository.save(episode);
    }

    @Transactional
    @RequiresModule(PodcastModule.KEY)
    public Episode archive(Long tenantId, Long episodeId) {
        Episode episode = episodeService.requireEpisode(tenantId, episodeId);
        PublicationTransitions.requirePublishedStatus(episode.getStatus() == EpisodeStatus.PUBLISHED, "episodes");
        demotePublicAudioIfNeeded(episode);
        episode.setStatus(EpisodeStatus.ARCHIVED);
        episode.setScheduledAt(null);
        Episode archived = episodeRepository.save(episode);
        rssFeedRefreshScheduler.requestRefreshAfterCommit(tenantId);
        return archived;
    }

    @Transactional
    @RequiresModule(PodcastModule.KEY)
    public Episode unarchive(Long tenantId, Long episodeId) {
        Episode episode = episodeService.requireEpisode(tenantId, episodeId);
        PublicationTransitions.requireArchivedStatus(episode.getStatus() == EpisodeStatus.ARCHIVED, "episodes");
        episode.setStatus(EpisodeStatus.DRAFT);
        episode.setPublishedAt(null);
        episode.setScheduledAt(null);
        return episodeRepository.save(episode);
    }

    private void demotePublicAudioIfNeeded(Episode episode) {
        MediaAsset audioAsset = episode.getAudioAsset();
        if (audioAsset != null && audioAsset.getId() != null && audioAsset.getVisibility() == AssetVisibility.PUBLIC) {
            episode.setAudioAsset(episodeMediaApi.demoteToPrivate(audioAsset.getId()));
        }
    }

    public int publishDueScheduled() {
        List<DueItem> dueItems = episodeRepository
                .findByStatusAndScheduledAtLessThanEqualOrderByScheduledAtAscIdAsc(
                        EpisodeStatus.SCHEDULED,
                        Instant.now()
                ).stream()
                .map(episode -> new DueItem(episode.getTenant().getId(), episode.getId()))
                .toList();
        PublicationWorkflowService proxy = self.getObject();
        return scheduledPublicationExecutor.publishDue(
                PodcastModule.KEY,
                dueItems,
                proxy::publishScheduledEpisode,
                "episodes"
        );
    }

    @Transactional
    @RequiresModule(PodcastModule.KEY)
    public void publishScheduledEpisode(Long tenantId, Long episodeId) {
        Episode episode = episodeService.requireEpisode(tenantId, episodeId);
        if (PublicationLifecycleSupport.skipScheduledPublishIfStatusChanged(
                episode.getStatus() == EpisodeStatus.SCHEDULED,
                log,
                "episode",
                episodeId,
                tenantId,
                episode.getStatus()
        )) {
            return;
        }
        publishInternal(tenantId, episode, episode.isNotifySubscribersOnPublish(), null);
    }

    private Episode publishInternal(
            Long tenantId,
            Episode episode,
            boolean notifySubscribers,
            Instant requestedPublishedAt
    ) {
        PublicationTransitions.requireDraftOrScheduled(
                episode.getStatus() == EpisodeStatus.DRAFT || episode.getStatus() == EpisodeStatus.SCHEDULED,
                "episodes");
        requirePublishedSeries(episode);
        if (episode.getTitle() == null || episode.getTitle().isBlank()) {
            throw new EpisodeValidationException("Episode title is required");
        }

        String sanitizedDescription = htmlSanitizer.sanitize(episode.getDescription());
        if (PublicationTexts.isBlankHtml(sanitizedDescription)) {
            throw new EpisodeValidationException("Episode description is required");
        }
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
            throw new EpisodeValidationException("Episode has a deactivated format assigned; update formats before publishing");
        }

        episodeMediaApi.attachEpisode(readyAudio.getId(), episode.getId());
        if (episode.getAccessPolicy() == AccessPolicy.FREE) {
            MediaAsset publicAudio = episodeMediaApi.promoteToPublic(readyAudio.getId());
            episode.setAudioAsset(publicAudio);
        } else {
            episode.setAudioAsset(readyAudio);
        }

        Instant publishedAt = PublicationTransitions.resolvePublishedAt(
                requestedPublishedAt,
                episode.getPublishedAt()
        );
        episode.setStatus(EpisodeStatus.PUBLISHED);
        episode.setPublishedAt(publishedAt);
        episode.setScheduledAt(null);
        Episode published = episodeRepository.save(episode);

        rssFeedRefreshScheduler.requestRefreshAfterCommit(tenantId);
        maybeNotifySubscribers(tenantId, published, notifySubscribers);
        return published;
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

    private void maybeNotifySubscribers(Long tenantId, Episode published, boolean notifySubscribers) {
        Instant notifiedAt = Instant.now();
        PublicationNotificationSupport.maybeNotify(
                tenantId,
                ContentType.EPISODE,
                published.getId(),
                published.getTitle(),
                PublicationTexts.htmlExcerpt(published.getDescription()),
                published.getSlug(),
                published.getAccessPolicy().name(),
                notifySubscribers,
                notificationGate,
                contentPublishedNotifier,
                () -> episodeRepository.claimEmailNotification(tenantId, published.getId(), notifiedAt),
                () -> published.setEmailNotifiedAt(notifiedAt)
        );
    }
}
