package de.pnnit.directwerk.modules.email.repository;

import de.pnnit.directwerk.modules.email.entity.EmailDelivery;
import java.util.UUID;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.query.Param;

public interface EmailDeliveryRepository extends JpaRepository<EmailDelivery, UUID> {

    @Modifying
    @Query(
            value = """
                    INSERT INTO email_deliveries (job_id, delivered_at)
                    VALUES (:jobId, :deliveredAt)
                    ON CONFLICT (job_id) DO NOTHING
                    """,
            nativeQuery = true
    )
    int insertIfAbsent(@Param("jobId") UUID jobId, @Param("deliveredAt") java.time.Instant deliveredAt);

    /**
     * Re-claims a provisional row that outlived its lease (the previous attempt likely crashed
     * between the claim and the send). A finalized row ({@code sent_at} set) or a fresh
     * in-flight claim is left untouched.
     */
    @Modifying
    @Query(
            value = """
                    UPDATE email_deliveries
                    SET delivered_at = :claimedAt
                    WHERE job_id = :jobId
                      AND sent_at IS NULL
                      AND delivered_at < :staleBefore
                    """,
            nativeQuery = true
    )
    int takeOverStaleClaim(
            @Param("jobId") UUID jobId,
            @Param("claimedAt") java.time.Instant claimedAt,
            @Param("staleBefore") java.time.Instant staleBefore
    );

    @Modifying
    @Query(
            value = "UPDATE email_deliveries SET sent_at = :sentAt WHERE job_id = :jobId",
            nativeQuery = true
    )
    int finalizeClaim(@Param("jobId") UUID jobId, @Param("sentAt") java.time.Instant sentAt);

    @Modifying
    @Query(value = "DELETE FROM email_deliveries WHERE job_id = :jobId", nativeQuery = true)
    int deleteClaim(@Param("jobId") UUID jobId);

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
