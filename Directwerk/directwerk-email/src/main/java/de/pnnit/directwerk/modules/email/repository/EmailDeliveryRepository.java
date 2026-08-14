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
