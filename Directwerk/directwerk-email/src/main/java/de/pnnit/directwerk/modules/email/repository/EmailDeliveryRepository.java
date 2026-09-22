package de.pnnit.directwerk.modules.email.repository;

import de.pnnit.directwerk.modules.email.entity.EmailDelivery;
import java.util.UUID;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.util.Optional;

public interface EmailDeliveryRepository extends JpaRepository<EmailDelivery, UUID> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            SELECT d FROM EmailDelivery d
            WHERE d.jobId = :jobId
              AND d.claimToken = :claimToken
              AND d.sentAt IS NULL
            """)
    Optional<EmailDelivery> findOwnedClaimForUpdate(
            @Param("jobId") UUID jobId,
            @Param("claimToken") UUID claimToken
    );

    @Modifying
    @Query(
            value = """
                    INSERT INTO email_deliveries (job_id, delivered_at, claim_token)
                    VALUES (:jobId, :deliveredAt, :claimToken)
                    ON CONFLICT (job_id) DO NOTHING
                    """,
            nativeQuery = true
    )
    int insertIfAbsent(
            @Param("jobId") UUID jobId,
            @Param("deliveredAt") java.time.Instant deliveredAt,
            @Param("claimToken") UUID claimToken
    );

    /**
     * Re-claims a provisional row that outlived its lease (the previous attempt likely crashed
     * between the claim and the send). A finalized row ({@code sent_at} set) or a fresh
     * in-flight claim is left untouched.
     */
    @Modifying
    @Query(
            value = """
                    UPDATE email_deliveries
                    SET delivered_at = :claimedAt,
                        claim_token = :claimToken
                    WHERE job_id = :jobId
                      AND sent_at IS NULL
                      AND delivered_at < :staleBefore
                    """,
            nativeQuery = true
    )
    int takeOverStaleClaim(
            @Param("jobId") UUID jobId,
            @Param("claimedAt") java.time.Instant claimedAt,
            @Param("staleBefore") java.time.Instant staleBefore,
            @Param("claimToken") UUID claimToken
    );

    @Modifying
    @Query(
            value = """
                    UPDATE email_deliveries SET sent_at = :sentAt
                    WHERE job_id = :jobId AND claim_token = :claimToken
                    """,
            nativeQuery = true
    )
    int finalizeClaim(
            @Param("jobId") UUID jobId,
            @Param("claimToken") UUID claimToken,
            @Param("sentAt") java.time.Instant sentAt
    );

    @Modifying
    @Query(
            value = "DELETE FROM email_deliveries WHERE job_id = :jobId AND claim_token = :claimToken AND sent_at IS NULL",
            nativeQuery = true
    )
    int deleteClaim(@Param("jobId") UUID jobId, @Param("claimToken") UUID claimToken);

    @Modifying
    @Query(
            value = """
                    DELETE FROM email_deliveries
                    WHERE job_id IN (
                        SELECT job_id
                        FROM email_deliveries
                        WHERE delivered_at < :cutoff
                        ORDER BY delivered_at, job_id
                        LIMIT :limit
                    )
                    """,
            nativeQuery = true
    )
    int deleteOlderThan(@Param("cutoff") java.time.Instant cutoff, @Param("limit") int limit);
}
