package de.pnnit.directwerk.modules.email;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.queue.JobEnqueueMetadata;
import de.pnnit.directwerk.modules.queue.JobStatus;
import de.pnnit.directwerk.modules.queue.QueueJob;
import de.pnnit.directwerk.modules.queue.QueueNames;
import de.pnnit.directwerk.modules.queue.QueueService;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@ExtendWith(MockitoExtension.class)
class EmailJobProducerTest {

    @Mock
    private DirectwerkConfig directwerkConfig;

    @Mock
    private QueueService queueService;

    @Mock
    private EmailTokenProtector emailTokenProtector;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private EmailJobProducer producer;

    @BeforeEach
    void setUp() {
        producer = new EmailJobProducer(directwerkConfig, queueService, objectMapper, emailTokenProtector);
    }

    @Test
    void skipsEnqueueWhenEmailDisabled() {
        when(directwerkConfig.isEmailEnabled()).thenReturn(false);

        producer.sendTenantInvitation(
                1L,
                "a@example.com",
                "Ada",
                "Acme",
                "EDITOR",
                "token",
                Duration.ofHours(24)
        );

        verify(queueService, never()).enqueue(
                anyString(),
                any(),
                anyInt(),
                any(),
                any(),
                any(JobEnqueueMetadata.class)
        );
        verify(emailTokenProtector, never()).protectForQueue(org.mockito.ArgumentMatchers.anyString());
    }

    @Test
    void enqueuesTenantInvitationPayload() {
        when(directwerkConfig.isEmailEnabled()).thenReturn(true);
        when(emailTokenProtector.protectForQueue("invite-token")).thenReturn("enc:invite-token");
        Instant now = Instant.parse("2026-07-18T10:00:00Z");
        when(queueService.enqueue(eq(QueueNames.EMAIL), any(), eq(0), isNull(), isNull(), any(JobEnqueueMetadata.class)))
                .thenAnswer(invocation -> sampleJob(invocation.getArgument(1), now, invocation.getArgument(5)));

        producer.sendTenantInvitation(
                1L,
                "a@example.com",
                "Ada",
                "Acme",
                "EDITOR",
                "invite-token",
                Duration.ofHours(24)
        );

        ArgumentCaptor<JsonNode> payloadCaptor = ArgumentCaptor.forClass(JsonNode.class);
        ArgumentCaptor<JobEnqueueMetadata> metadataCaptor = ArgumentCaptor.forClass(JobEnqueueMetadata.class);
        verify(queueService).enqueue(
                eq(QueueNames.EMAIL),
                payloadCaptor.capture(),
                eq(0),
                isNull(),
                isNull(),
                metadataCaptor.capture()
        );
        JsonNode payload = payloadCaptor.getValue();
        assertThat(payload.get("template").asString()).isEqualTo("TENANT_INVITATION");
        assertThat(payload.get("to").asString()).isEqualTo("a@example.com");
        assertThat(payload.get("token").asString()).isEqualTo("enc:invite-token");
        assertThat(payload.get("variables").get("expiresIn").asString()).isEqualTo("24 hours");

        JobEnqueueMetadata metadata = metadataCaptor.getValue();
        assertThat(metadata.tenantId()).isEqualTo(1L);
    }

    @Test
    void enqueuesPasswordResetPayload() {
        when(directwerkConfig.isEmailEnabled()).thenReturn(true);
        when(emailTokenProtector.protectForQueue("reset-token")).thenReturn("enc:reset-token");
        Instant now = Instant.parse("2026-07-18T10:00:00Z");
        when(queueService.enqueue(eq(QueueNames.EMAIL), any(), eq(0), isNull(), isNull(), any(JobEnqueueMetadata.class)))
                .thenAnswer(invocation -> sampleJob(invocation.getArgument(1), now, invocation.getArgument(5)));

        producer.sendPasswordReset("a@example.com", "reset-token", Duration.ofHours(1));

        ArgumentCaptor<JsonNode> payloadCaptor = ArgumentCaptor.forClass(JsonNode.class);
        verify(queueService).enqueue(
                eq(QueueNames.EMAIL),
                payloadCaptor.capture(),
                eq(0),
                isNull(),
                isNull(),
                any(JobEnqueueMetadata.class)
        );
        assertThat(payloadCaptor.getValue().get("template").asString()).isEqualTo("PASSWORD_RESET");
        assertThat(payloadCaptor.getValue().get("variables").get("expiresIn").asString()).isEqualTo("1 hour");
    }

    private static QueueJob sampleJob(JsonNode payload, Instant now, JobEnqueueMetadata metadata) {
        return new QueueJob(
                UUID.randomUUID(),
                QueueNames.EMAIL,
                payload,
                0,
                JobStatus.QUEUED,
                now,
                0,
                5,
                null,
                null,
                null,
                metadata.tenantId(),
                metadata.correlationId(),
                metadata.metadata(),
                now,
                now
        );
    }
}
