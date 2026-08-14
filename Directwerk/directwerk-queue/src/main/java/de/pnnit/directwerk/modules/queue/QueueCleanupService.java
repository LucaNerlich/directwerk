package de.pnnit.directwerk.modules.queue;

import de.pnnit.directwerk.config.DirectwerkConfig;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Deletes terminal ({@code COMPLETED}/{@code FAILED}) jobs older than the configured retention.
 */
@Service
public class QueueCleanupService {

    private static final Logger log = LoggerFactory.getLogger(QueueCleanupService.class);
    private static final int MAX_BATCHES_PER_RUN = 100;

    private final QueueRepository queueRepository;
    private final DirectwerkConfig directwerkConfig;
    private final Clock clock;

    /**
     * Creates a service for removing stale terminal queue jobs.
     *
     * @param queueRepository data access for terminal queue jobs
     * @param directwerkConfig configuration for queue cleanup
     * @param clock           source of the current time
     */
    public QueueCleanupService(
            QueueRepository queueRepository,
            DirectwerkConfig directwerkConfig,
            Clock clock
    ) {
        this.queueRepository = queueRepository;
        this.directwerkConfig = directwerkConfig;
        this.clock = clock;
    }

    /**
     * Purges stale terminal jobs in bounded batches.
     *
     * @return total rows deleted in this run
     */
    public int cleanup() {
        var properties = directwerkConfig.queue();
        if (!properties.enabled()) {
            return 0;
        }
        long retentionDays = Math.max(1L, properties.retentionDays());
        int batchSize = Math.max(1, properties.cleanupBatchSize());
        Instant cutoff = clock.instant().minus(Duration.ofDays(retentionDays));

        int totalDeleted = 0;
        for (int batch = 0; batch < MAX_BATCHES_PER_RUN; batch++) {
            int deleted = queueRepository.deleteTerminalJobsOlderThan(cutoff, batchSize);
            totalDeleted += deleted;
            if (deleted < batchSize) {
                break;
            }
        }

        if (totalDeleted > 0) {
            log.info(
                    "Purged {} terminal queue job(s) older than {} day(s) (cutoff={})",
                    totalDeleted,
                    retentionDays,
                    cutoff
            );
        }
        return totalDeleted;
    }
}
