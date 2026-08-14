package de.pnnit.directwerk.modules.email;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.email.repository.EmailDeliveryRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EmailDeliveryCleanupService {

    private static final Logger log = LoggerFactory.getLogger(EmailDeliveryCleanupService.class);
    private static final int MAX_BATCHES_PER_RUN = 100;

    private final EmailDeliveryRepository emailDeliveryRepository;
    private final DirectwerkConfig directwerkConfig;
    private final Clock clock;
    private final EmailDeliveryCleanupService self;

    public EmailDeliveryCleanupService(
            EmailDeliveryRepository emailDeliveryRepository,
            DirectwerkConfig directwerkConfig,
            Clock clock,
            @Lazy EmailDeliveryCleanupService self
    ) {
        this.emailDeliveryRepository = emailDeliveryRepository;
        this.directwerkConfig = directwerkConfig;
        this.clock = clock;
        this.self = self;
    }

    public int cleanup() {
        long retentionDays = Math.max(1L, directwerkConfig.email().deliveryRetentionDays());
        int batchSize = Math.max(1, directwerkConfig.queue().cleanupBatchSize());
        Instant cutoff = clock.instant().minus(Duration.ofDays(retentionDays));

        int totalDeleted = 0;
        for (int batch = 0; batch < MAX_BATCHES_PER_RUN; batch++) {
            int deleted = self.deleteBatch(cutoff, batchSize);
            totalDeleted += deleted;
            if (deleted < batchSize) {
                break;
            }
        }

        if (totalDeleted > 0) {
            log.info("Purged {} email delivery record(s) older than {} day(s)", totalDeleted, retentionDays);
        }
        return totalDeleted;
    }

    @Transactional
    public int deleteBatch(Instant cutoff, int batchSize) {
        return emailDeliveryRepository.deleteOlderThan(cutoff, batchSize);
    }
}
