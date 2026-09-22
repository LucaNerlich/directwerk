package de.pnnit.directwerk.modules.email;

import de.pnnit.directwerk.modules.email.repository.EmailDeliveryRepository;
import java.time.Clock;
import java.time.Duration;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EmailDeliveryGuard {

    /**
     * How long a provisional claim is considered in-flight. A claim older than this (with no
     * recorded send) belongs to a crashed attempt and may be taken over, so a JVM/pod death
     * between claim and send cannot permanently lose the email. Must stay below the queue's
     * lease (default 60s), otherwise the queue's own retry would arrive while the claim still
     * looks fresh and be skipped.
     */
    private static final Duration CLAIM_LEASE = Duration.ofSeconds(30);

    private final EmailDeliveryRepository emailDeliveryRepository;
    private final Clock clock;

    public EmailDeliveryGuard(EmailDeliveryRepository emailDeliveryRepository, Clock clock) {
        this.emailDeliveryRepository = emailDeliveryRepository;
        this.clock = clock;
    }

    /**
     * Claims durable delivery ownership for a queue job. Returns false when the job was already
     * delivered, or when another worker holds a fresh provisional claim. A provisional claim
     * older than the lease is taken over and returns true.
     */
    @Transactional
    public boolean tryClaimDelivery(UUID jobId) {
        var now = clock.instant();
        if (emailDeliveryRepository.insertIfAbsent(jobId, now) > 0) {
            return true;
        }
        return emailDeliveryRepository.takeOverStaleClaim(jobId, now, now.minus(CLAIM_LEASE)) > 0;
    }

    /** Marks a provisional claim as sent; after this the row permanently suppresses re-delivery. */
    @Transactional
    public void finalizeClaim(UUID jobId) {
        emailDeliveryRepository.finalizeClaim(jobId, clock.instant());
    }

    @Transactional
    public void releaseClaim(UUID jobId) {
        emailDeliveryRepository.deleteClaim(jobId);
    }
}
