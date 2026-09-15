package de.pnnit.directwerk.job;

import de.pnnit.directwerk.modules.email.TransactionalEmailService;
import de.pnnit.directwerk.modules.podcast.exception.RssImportException;
import de.pnnit.directwerk.modules.podcast.service.PodcastImportService;
import de.pnnit.directwerk.modules.queue.JobHandler;
import de.pnnit.directwerk.modules.queue.QueueJob;
import de.pnnit.directwerk.modules.queue.QueueNames;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

/**
 * Imports every not-yet-imported episode of an RSS feed with shared defaults.
 *
 * <p>Each episode is imported in isolation: per-episode failures are counted and
 * reported, never aborting the run. Episode imports are idempotent
 * (feed-URL + GUID identity), so a retried job cheaply skips finished work. A
 * summary email goes to the requester when the run completes. Lease heartbeats
 * from the worker keep long runs (dozens of audio downloads) alive.
 */
@Component
public class RssBulkImportJobHandler implements JobHandler {

    private static final Logger log = LoggerFactory.getLogger(RssBulkImportJobHandler.class);
    private static final BulkImportRun.Labels LABELS = new BulkImportRun.Labels(
            "Bulk RSS import failed for episode",
            "All new episodes imported cleanly.",
            "Bulk RSS import finished"
    );

    private final ObjectMapper objectMapper;
    private final PodcastImportService podcastImportService;
    private final TransactionalEmailService transactionalEmailService;

    public RssBulkImportJobHandler(
            ObjectMapper objectMapper,
            PodcastImportService podcastImportService,
            TransactionalEmailService transactionalEmailService
    ) {
        this.objectMapper = objectMapper;
        this.podcastImportService = podcastImportService;
        this.transactionalEmailService = transactionalEmailService;
    }

    @Override
    public String queueName() {
        return QueueNames.PODCAST_RSS_BULK_IMPORT;
    }

    @Override
    public void handle(QueueJob job) {
        RssBulkImportPayload payload = objectMapper.convertValue(job.payload(), RssBulkImportPayload.class);
        if (payload == null || payload.seriesId() == null || payload.feedUrl() == null
                || payload.feedUrl().isBlank() || payload.notifyEmail() == null
                || payload.notifyEmail().isBlank()) {
            throw new IllegalArgumentException("Invalid podcast-rss-bulk-import job payload");
        }

        PodcastImportService.Preview preview = podcastImportService.preview(payload.feedUrl());
        if (preview.truncated()) {
            throw new RssImportException(
                    400,
                    "RSS_FEED_INVALID",
                    "A truncated RSS feed preview cannot be used for bulk import"
            );
        }

        BulkImportRun.run(
                new BulkImportRun.RunContext(
                        job,
                        preview.feedUrl(),
                        payload.notifyEmail(),
                        payload.requestedBy(),
                        LABELS,
                        transactionalEmailService,
                        log
                ),
                preview.episodes(),
                episode -> episode.alreadyImportedEpisodeId() != null,
                PodcastImportService.PreviewEpisode::guid,
                PodcastImportService.PreviewEpisode::title,
                RuntimeException.class,
                episode -> {
                    podcastImportService.importEpisode(new PodcastImportService.ImportEpisodeCommand(
                            payload.seriesId(),
                            preview.feedUrl(),
                            episode.guid(),
                            episode.suggestedSlug(),
                            episode.title(),
                            episode.description(),
                            episode.episodeNumber(),
                            episode.durationSeconds(),
                            payload.accessPolicy(),
                            payload.requiredLevelSortOrder(),
                            payload.formatIds(),
                            null,
                            payload.importAudio() ? episode.audioUrl() : null,
                            payload.importImage() ? episode.imageUrl() : null,
                            null,
                            null,
                            episode.publishedAt()
                    ));
                    return BulkImportRun.Outcome.IMPORTED;
                }
        );
    }
}
