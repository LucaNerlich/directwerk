package de.pnnit.directwerk.modules.email;

import de.pnnit.directwerk.modules.email.repository.EmailDeliveryRepository;
import java.time.Clock;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EmailDeliveryGuard {

    private final EmailDeliveryRepository emailDeliveryRepository;
    private final Clock clock;

    public EmailDeliveryGuard(EmailDeliveryRepository emailDeliveryRepository, Clock clock) {
        this.emailDeliveryRepository = emailDeliveryRepository;
        this.clock = clock;
    }

    /**
     * Claims durable delivery ownership for a queue job. Returns false when the job was already delivered.
     */
    @Transactional
    public boolean tryClaimDelivery(UUID jobId) {
        return emailDeliveryRepository.insertIfAbsent(jobId, clock.instant()) > 0;
    }

    @Transactional
    public void releaseClaim(UUID jobId) {
        emailDeliveryRepository.deleteClaim(jobId);
    }
}
