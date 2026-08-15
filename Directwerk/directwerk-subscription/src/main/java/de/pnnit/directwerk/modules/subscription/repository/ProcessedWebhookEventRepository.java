package de.pnnit.directwerk.modules.subscription.repository;

import de.pnnit.directwerk.modules.subscription.entity.ProcessedWebhookEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface ProcessedWebhookEventRepository extends JpaRepository<ProcessedWebhookEvent, Long> {

    boolean existsByEventId(String eventId);

    /**
     * Atomically records a processed webhook event. Returns {@code 1} when the row was inserted
     * (first delivery) and {@code 0} when it already existed (concurrent duplicate or replay), so
     * the event is never applied more than once.
     */
    @Modifying
    @Query(value = """
            INSERT INTO processed_webhook_events (event_id, event_type, stripe_account_id, processed_at)
            VALUES (:eventId, :eventType, :stripeAccountId, clock_timestamp())
            ON CONFLICT (event_id) DO NOTHING
            """, nativeQuery = true)
    int insertIfAbsent(
            @Param("eventId") String eventId,
            @Param("eventType") String eventType,
            @Param("stripeAccountId") String stripeAccountId
    );
}
