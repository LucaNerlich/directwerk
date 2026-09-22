package de.pnnit.directwerk.modules.email.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "email_deliveries")
@Getter
@Setter
@NoArgsConstructor
public class EmailDelivery {

    @Id
    @Column(name = "job_id", nullable = false)
    private UUID jobId;

    @Column(name = "delivered_at", nullable = false)
    private Instant deliveredAt = Instant.now();

    /**
     * When the send actually succeeded. {@code null} marks a provisional claim (the row was
     * taken but the transport call may not have completed); a stale provisional claim is
     * re-deliverable, while a finalized row is a permanent at-most-once guard.
     */
    @Column(name = "sent_at")
    private Instant sentAt;

    @Column(name = "claim_token", nullable = false)
    private UUID claimToken;

    public EmailDelivery(UUID jobId) {
        this.jobId = jobId;
    }
}
