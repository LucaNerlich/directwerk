package de.pnnit.directwerk.modules.digital.job;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.digital.exception.UploadValidationException;
import de.pnnit.directwerk.modules.queue.JobEnqueueMetadata;
import de.pnnit.directwerk.modules.queue.QueueService;
import de.pnnit.directwerk.multitenancy.TenantContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.ObjectProvider;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

class RemoteAssetIngestJobProducerTest {

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId(10L);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void enqueueCreatesTenantScopedJobWithCorrelationId() {
        QueueService queueService = mock(QueueService.class);
        @SuppressWarnings("unchecked")
        ObjectProvider<QueueService> queueProvider = mock(ObjectProvider.class);
        when(queueProvider.getObject()).thenReturn(queueService);
        DirectwerkConfig config = mock(DirectwerkConfig.class);
        when(config.isQueueEnabled()).thenReturn(true);
        RemoteAssetIngestJobProducer producer = new RemoteAssetIngestJobProducer(
                queueProvider,
                new ObjectMapper(),
                config
        );

        producer.enqueue(42L, "https://cdn.example/ep.mp3", "episode.mp3");

        ArgumentCaptor<JsonNode> payload = ArgumentCaptor.forClass(JsonNode.class);
        ArgumentCaptor<JobEnqueueMetadata> metadata = ArgumentCaptor.forClass(JobEnqueueMetadata.class);
        verify(queueService).enqueue(
                eq(MediaJobQueueNames.REMOTE_ASSET_INGEST),
                payload.capture(),
                eq(0),
                eq(null),
                eq(null),
                metadata.capture()
        );
        assertThat(payload.getValue().get("mediaAssetId").asLong()).isEqualTo(42L);
        assertThat(payload.getValue().get("sourceUrl").asText()).isEqualTo("https://cdn.example/ep.mp3");
        assertThat(payload.getValue().get("filenameHint").asText()).isEqualTo("episode.mp3");
        assertThat(metadata.getValue().tenantId()).isEqualTo(10L);
        assertThat(metadata.getValue().correlationId()).isEqualTo("remote-asset-ingest-42");
    }

    @Test
    void rejectsWhenQueueDisabled() {
        QueueService queueService = mock(QueueService.class);
        @SuppressWarnings("unchecked")
        ObjectProvider<QueueService> queueProvider = mock(ObjectProvider.class);
        when(queueProvider.getObject()).thenReturn(queueService);
        DirectwerkConfig config = mock(DirectwerkConfig.class);
        when(config.isQueueEnabled()).thenReturn(false);
        RemoteAssetIngestJobProducer producer = new RemoteAssetIngestJobProducer(
                queueProvider,
                new ObjectMapper(),
                config
        );

        assertThatThrownBy(() -> producer.enqueue(42L, "https://cdn.example/ep.mp3", null))
                .isInstanceOf(UploadValidationException.class)
                .hasMessageContaining("job queue");
        verify(queueService, org.mockito.Mockito.never()).enqueue(
                any(), any(), eq(0), eq(null), eq(null), any(JobEnqueueMetadata.class)
        );
    }
}
