package de.pnnit.directwerk.modules.digital.job;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import de.pnnit.directwerk.modules.digital.service.RemoteAssetIngestService;
import de.pnnit.directwerk.modules.queue.JobStatus;
import de.pnnit.directwerk.modules.queue.QueueJob;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.JsonNodeFactory;

class RemoteAssetIngestJobHandlerTest {

    @Test
    void delegatesToRemoteAssetIngestService() {
        RemoteAssetIngestService ingestService = mock(RemoteAssetIngestService.class);
        RemoteAssetIngestJobHandler handler = new RemoteAssetIngestJobHandler(new ObjectMapper(), ingestService);
        QueueJob job = new QueueJob(
                UUID.randomUUID(),
                MediaJobQueueNames.REMOTE_ASSET_INGEST,
                JsonNodeFactory.instance.objectNode()
                        .put("mediaAssetId", 42L)
                        .put("sourceUrl", "https://cdn.example/ep.mp3")
                        .put("filenameHint", "episode.mp3"),
                0,
                JobStatus.PROCESSING,
                Instant.now(),
                1,
                5,
                "worker-1",
                Instant.now().plusSeconds(900),
                null,
                10L,
                "remote-asset-ingest-42",
                null,
                Instant.now(),
                Instant.now()
        );

        handler.handle(job);

        verify(ingestService).processQueuedIngest(any(RemoteAssetIngestJobPayload.class), eq(job));
    }
}
