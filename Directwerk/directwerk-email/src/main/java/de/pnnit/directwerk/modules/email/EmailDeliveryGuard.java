package de.pnnit.directwerk.modules.email;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.email.repository.EmailDeliveryRepository;
import java.time.Clock;
import java.time.Duration;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class EmailDeliveryGuard {

    /**
     * How long a provisional claim is considered in-flight, derived from the queue lease so the
     * two can never drift (issue #326). A claim older than this (with no recorded send) belongs to
     * a crashed attempt and may be taken over, so a JVM/pod death between claim and send cannot
     * permanently lose the email. Kept strictly below the queue's lease: otherwise the queue's own
     * retry would arrive while the claim still looks fresh and be skipped as a duplicate.
     */
    private final Duration claimLease;

    private final EmailDeliveryRepository emailDeliveryRepository;
    private final Clock clock;
    private final TransactionTemplate transactionTemplate;

    public EmailDeliveryGuard(
            EmailDeliveryRepository emailDeliveryRepository,
            Clock clock,
            PlatformTransactionManager transactionManager,
            DirectwerkConfig directwerkConfig
    ) {
        this.emailDeliveryRepository = emailDeliveryRepository;
        this.clock = clock;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
        long queueLeaseSeconds = directwerkConfig.queue() == null
                ? 60L
                : directwerkConfig.queue().leaseSeconds();
        this.claimLease = Duration.ofSeconds(Math.max(1L, queueLeaseSeconds / 2));
    }

    /**
     * Claims durable delivery ownership for a queue job. Returns empty when the job was already
     * delivered, or when another worker holds a fresh provisional claim. A provisional claim
     * older than the lease is taken over and returns the new ownership token.
     */
    @Transactional
    public Optional<DeliveryClaim> tryClaimDelivery(UUID jobId) {
        var now = clock.instant();
        UUID claimToken = UUID.randomUUID();
        if (emailDeliveryRepository.insertIfAbsent(jobId, now, claimToken) > 0) {
            return Optional.of(new DeliveryClaim(jobId, claimToken));
        }
        if (emailDeliveryRepository.takeOverStaleClaim(
                jobId, now, now.minus(claimLease), claimToken) > 0) {
            return Optional.of(new DeliveryClaim(jobId, claimToken));
        }
        return Optional.empty();
    }

    /**
     * Fences the owned claim in one short transaction, runs the outbound submission OUTSIDE any
     * transaction, then finalizes in a second short transaction (issue #325).
     * <p>
     * Deliberately not {@code @Transactional}: holding a pooled DB connection and the claim row
     * lock across a slow SMTP/Mailgun round trip exhausts Hikari and serializes every delivery on
     * that row lock. The claim token still fences the owner — if a takeover replaced it, the
     * finalize step is a no-op.
     */
    public boolean finalizeClaim(DeliveryClaim claim, Runnable outboundSubmission) {
        boolean owned = Boolean.TRUE.equals(transactionTemplate.execute(status ->
                emailDeliveryRepository.findOwnedClaimForUpdate(claim.jobId(), claim.claimToken())
                        .isPresent()));
        if (!owned) {
            return false;
        }
        outboundSubmission.run();
        Integer updated = transactionTemplate.execute(status -> emailDeliveryRepository.finalizeClaim(
                claim.jobId(), claim.claimToken(), clock.instant()));
        return updated != null && updated > 0;
    }

    @Transactional
    public void releaseClaim(DeliveryClaim claim) {
        emailDeliveryRepository.deleteClaim(claim.jobId(), claim.claimToken());
    }

    public record DeliveryClaim(UUID jobId, UUID claimToken) {
    }
}
