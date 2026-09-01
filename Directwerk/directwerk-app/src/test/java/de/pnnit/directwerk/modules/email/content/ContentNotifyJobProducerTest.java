package de.pnnit.directwerk.modules.email.content;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.content.ContentPublishedEvent;
import de.pnnit.directwerk.modules.content.ContentType;
import de.pnnit.directwerk.modules.queue.JobEnqueueMetadata;
import de.pnnit.directwerk.modules.queue.JobStatus;
import de.pnnit.directwerk.modules.queue.QueueJob;
import de.pnnit.directwerk.modules.queue.QueueNames;
import de.pnnit.directwerk.modules.queue.QueueService;
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
class ContentNotifyJobProducerTest {

    @Mock
    private QueueService queueService;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private ContentNotifyJobProducer producer;

    @BeforeEach
    void setUp() {
        producer = new ContentNotifyJobProducer(queueService, objectMapper);
    }

    @Test
    void enqueuesContentNotificationWithTenantScopedCorrelationId() {
        Instant now = Instant.parse("2026-07-18T10:00:00Z");
        when(queueService.enqueue(eq(QueueNames.CONTENT_NOTIFY), any(), eq(0), isNull(), isNull(), any(JobEnqueueMetadata.class)))
                .thenAnswer(invocation -> sampleJob(invocation.getArgument(1), now, invocation.getArgument(5)));

        producer.notifyContentPublished(new ContentPublishedEvent(
                10L,
                ContentType.EPISODE,
                7L,
                "Hello world",
                "Excerpt",
                "hello-world",
                "FREE"
        ));

        ArgumentCaptor<JsonNode> payloadCaptor = ArgumentCaptor.forClass(JsonNode.class);
        ArgumentCaptor<JobEnqueueMetadata> metadataCaptor = ArgumentCaptor.forClass(JobEnqueueMetadata.class);
        verify(queueService).enqueue(
                eq(QueueNames.CONTENT_NOTIFY),
                payloadCaptor.capture(),
                eq(0),
                isNull(),
                isNull(),
                metadataCaptor.capture()
        );

        JsonNode payload = payloadCaptor.getValue();
        assertThat(payload.get("contentType").asString()).isEqualTo("EPISODE");
        assertThat(payload.get("contentId").asLong()).isEqualTo(7L);
        assertThat(payload.get("title").asString()).isEqualTo("Hello world");
        assertThat(payload.get("slug").asString()).isEqualTo("hello-world");

        JobEnqueueMetadata metadata = metadataCaptor.getValue();
        assertThat(metadata.tenantId()).isEqualTo(10L);
        assertThat(metadata.correlationId()).isEqualTo("content-notify-episode-7");
    }

    private static QueueJob sampleJob(JsonNode payload, Instant now, JobEnqueueMetadata metadata) {
        return new QueueJob(
                UUID.randomUUID(),
                QueueNames.CONTENT_NOTIFY,
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
