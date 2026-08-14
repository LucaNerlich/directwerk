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

    public EmailDelivery(UUID jobId) {
        this.jobId = jobId;
    }
}
