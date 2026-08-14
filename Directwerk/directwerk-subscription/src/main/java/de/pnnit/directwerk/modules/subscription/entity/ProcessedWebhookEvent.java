package de.pnnit.directwerk.modules.subscription.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.Getter;
import lombok.Setter;

/**
 * Platform-wide Stripe event idempotency. Not tenant-owned: Connect webhooks
 * arrive without a Host tenant and are keyed by Stripe {@code event_id}.
 */
@Entity
@Table(name = "processed_webhook_events")
@Getter
@Setter
public class ProcessedWebhookEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "event_id", nullable = false, unique = true, length = 128)
    private String eventId;

    @Column(name = "event_type", nullable = false, length = 128)
    private String eventType;

    @Column(name = "stripe_account_id", length = 64)
    private String stripeAccountId;

    @Column(name = "processed_at", nullable = false)
    private Instant processedAt = Instant.now();
}
