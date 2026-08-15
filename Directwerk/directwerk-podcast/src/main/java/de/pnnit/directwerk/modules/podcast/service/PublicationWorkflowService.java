package de.pnnit.directwerk.modules.podcast.service;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.content.ContentPublishedEvent;
import de.pnnit.directwerk.modules.content.ContentPublishedNotifier;
import de.pnnit.directwerk.modules.content.ContentType;
import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import de.pnnit.directwerk.modules.digital.api.EpisodeMediaApi;
import de.pnnit.directwerk.modules.digital.entity.AssetVisibility;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.podcast.PodcastModule;
import de.pnnit.directwerk.modules.digital.entity.AccessPolicy;
import de.pnnit.directwerk.modules.podcast.entity.Episode;
import de.pnnit.directwerk.modules.podcast.job.RssFeedRefreshJobProducer;
import de.pnnit.directwerk.modules.podcast.entity.EpisodeStatus;
import de.pnnit.directwerk.modules.podcast.exception.EpisodeValidationException;
import de.pnnit.directwerk.modules.digital.exception.InvalidPublicationTransitionException;
import de.pnnit.directwerk.modules.digital.service.HtmlSanitizer;
import de.pnnit.directwerk.modules.podcast.repository.EpisodeRepository;
import de.pnnit.directwerk.multitenancy.TenantContext;
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
    private final ModuleGateService moduleGateService;
    private final DirectwerkConfig directwerkConfig;
    private final ContentPublishedNotifier contentPublishedNotifier;
    private final RssFeedRefreshJobProducer rssFeedRefreshJobProducer;
    private final ObjectProvider<PublicationWorkflowService> self;

    @Transactional
    @RequiresModule(PodcastModule.KEY)
    public Episode publish(Long tenantId, Long episodeId) {
        return publish(tenantId, episodeId, false);
    }

    @Transactional
    @RequiresModule(PodcastModule.KEY)
    public Episode publish(Long tenantId, Long episodeId, boolean notifySubscribers) {
        Episode episode = episodeService.requireEpisode(tenantId, episodeId);
        return publishInternal(tenantId, episode, notifySubscribers);
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
        if (episode.getStatus() != EpisodeStatus.DRAFT) {
            throw new InvalidPublicationTransitionException("Only DRAFT episodes can be scheduled");
        }
        if (scheduledAt == null || !scheduledAt.isAfter(Instant.now())) {
            throw new EpisodeValidationException("scheduledAt must be in the future");
        }
        episode.setStatus(EpisodeStatus.SCHEDULED);
        episode.setScheduledAt(scheduledAt);
        episode.setNotifySubscribersOnPublish(notifySubscribers);
        return episodeRepository.save(episode);
    }

    @Transactional
    @RequiresModule(PodcastModule.KEY)
    public Episode cancelSchedule(Long tenantId, Long episodeId) {
        Episode episode = episodeService.requireEpisode(tenantId, episodeId);
        if (episode.getStatus() != EpisodeStatus.SCHEDULED) {
            throw new InvalidPublicationTransitionException("Only SCHEDULED episodes can be unscheduled");
        }
        episode.setStatus(EpisodeStatus.DRAFT);
        episode.setScheduledAt(null);
        return episodeRepository.save(episode);
    }

    @Transactional
    @RequiresModule(PodcastModule.KEY)
    public Episode unpublish(Long tenantId, Long episodeId) {
        Episode episode = episodeService.requireEpisode(tenantId, episodeId);
        if (episode.getStatus() != EpisodeStatus.PUBLISHED) {
            throw new InvalidPublicationTransitionException("Only PUBLISHED episodes can be unpublished");
        }
        demotePublicAudioIfNeeded(episode);
        episode.setStatus(EpisodeStatus.DRAFT);
        episode.setPublishedAt(null);
        episode.setScheduledAt(null);
        Episode unpublished = episodeRepository.save(episode);
        rssFeedRefreshJobProducer.requestRefreshAfterCommit(tenantId);
        return unpublished;
    }

    @Transactional
    @RequiresModule(PodcastModule.KEY)
    public Episode archive(Long tenantId, Long episodeId) {
        Episode episode = episodeService.requireEpisode(tenantId, episodeId);
        if (episode.getStatus() != EpisodeStatus.PUBLISHED) {
            throw new InvalidPublicationTransitionException("Only PUBLISHED episodes can be archived");
        }
        demotePublicAudioIfNeeded(episode);
        episode.setStatus(EpisodeStatus.ARCHIVED);
        episode.setScheduledAt(null);
        Episode archived = episodeRepository.save(episode);
        rssFeedRefreshJobProducer.requestRefreshAfterCommit(tenantId);
        return archived;
    }

    @Transactional
    @RequiresModule(PodcastModule.KEY)
    public Episode unarchive(Long tenantId, Long episodeId) {
        Episode episode = episodeService.requireEpisode(tenantId, episodeId);
        if (episode.getStatus() != EpisodeStatus.ARCHIVED) {
            throw new InvalidPublicationTransitionException("Only ARCHIVED episodes can be unarchived");
        }
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
        List<Episode> dueEpisodes = episodeRepository
                .findByStatusAndScheduledAtLessThanEqualOrderByScheduledAtAscIdAsc(
                        EpisodeStatus.SCHEDULED,
                        Instant.now()
                );
        int published = 0;
        PublicationWorkflowService proxy = self.getObject();
        for (Episode episode : dueEpisodes) {
            Long tenantId = episode.getTenant().getId();
            Long episodeId = episode.getId();
            try {
                TenantContext.runWithTenant(tenantId, () -> {
                    moduleGateService.requireModule(PodcastModule.KEY);
                    proxy.publishScheduledEpisode(tenantId, episodeId);
                });
                published++;
            } catch (Exception ex) {
                log.error("Failed to publish scheduled episode tenant={} episode={}", tenantId, episodeId, ex);
            }
        }
        return published;
    }

    @Transactional
    @RequiresModule(PodcastModule.KEY)
    public void publishScheduledEpisode(Long tenantId, Long episodeId) {
        Episode episode = episodeService.requireEpisode(tenantId, episodeId);
        if (episode.getStatus() != EpisodeStatus.SCHEDULED) {
            log.info("Skipping scheduled publish for episode={} tenant={} — status is no longer SCHEDULED ({})",
                    episodeId, tenantId, episode.getStatus());
            return;
        }
        publishInternal(tenantId, episode, episode.isNotifySubscribersOnPublish());
    }

    private Episode publishInternal(Long tenantId, Episode episode, boolean notifySubscribers) {
        if (episode.getStatus() != EpisodeStatus.DRAFT && episode.getStatus() != EpisodeStatus.SCHEDULED) {
            throw new InvalidPublicationTransitionException("Only DRAFT or SCHEDULED episodes can be published");
        }
        if (episode.getTitle() == null || episode.getTitle().isBlank()) {
            throw new EpisodeValidationException("Episode title is required");
        }

        String sanitizedDescription = htmlSanitizer.sanitize(episode.getDescription());
        if (isBlankHtml(sanitizedDescription)) {
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

        Instant now = Instant.now();
        episode.setStatus(EpisodeStatus.PUBLISHED);
        episode.setPublishedAt(now);
        episode.setScheduledAt(null);
        Episode published = episodeRepository.save(episode);

        rssFeedRefreshJobProducer.requestRefreshAfterCommit(tenantId);
        maybeNotifySubscribers(tenantId, published, notifySubscribers);
        return published;
    }

    private void maybeNotifySubscribers(Long tenantId, Episode published, boolean notifySubscribers) {
        if (!notifySubscribers) {
            return;
        }
        if (!directwerkConfig.isEmailEnabled()) {
            log.debug("Skipping episode notification tenant={} episode={} — email delivery disabled", tenantId, published.getId());
            return;
        }
        if (!moduleGateService.enabledModuleKeys(tenantId).contains("EMAIL_NOTIFY")) {
            log.debug("Skipping episode notification tenant={} episode={} — EMAIL_NOTIFY module not enabled", tenantId, published.getId());
            return;
        }
        Instant notifiedAt = Instant.now();
        int claimed = episodeRepository.claimEmailNotification(tenantId, published.getId(), notifiedAt);
        if (claimed == 0) {
            log.debug("Skipping episode notification tenant={} episode={} — already notified", tenantId, published.getId());
            return;
        }
        published.setEmailNotifiedAt(notifiedAt);
        contentPublishedNotifier.notifyContentPublished(new ContentPublishedEvent(
                tenantId,
                ContentType.EPISODE,
                published.getId(),
                published.getTitle(),
                htmlExcerpt(published.getDescription()),
                published.getSlug(),
                published.getAccessPolicy().name()
        ));
    }

    private static String htmlExcerpt(String html) {
        if (html == null) {
            return "";
        }
        String textOnly = html
                .replaceAll("<[^>]*>", " ")
                .replace("&nbsp;", " ")
                .replaceAll("\\s+", " ")
                .trim();
        if (textOnly.length() <= 280) {
            return textOnly;
        }
        return textOnly.substring(0, 277) + "...";
    }

    private static boolean isBlankHtml(String sanitizedDescription) {
        if (sanitizedDescription == null) {
            return true;
        }
        String textOnly = sanitizedDescription
                .replaceAll("<[^>]*>", "")
                .replace("&nbsp;", " ")
                .trim();
        return textOnly.isBlank();
    }
}
