package de.pnnit.directwerk.modules.digital.job;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import de.pnnit.directwerk.modules.digital.job.StagingCleanupService;
import de.pnnit.directwerk.modules.queue.QueueJob;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

@ExtendWith(MockitoExtension.class)
class MediaStagingCleanupJobHandlerTest {

    private final ObjectMapper objectMapper = JsonMapper.builder().build();

    @Mock
    private DirectwerkConfig directwerkConfig;

    @Mock
    private StagingCleanupService stagingCleanupService;

    @Test
    void deletesStagingKeyAndFolderForPayloadKey() {
        when(directwerkConfig.isStorageEnabled()).thenReturn(true);
        when(directwerkConfig.storage()).thenReturn(storageProps());

        MediaStagingCleanupJobHandler handler = new MediaStagingCleanupJobHandler(
                objectMapper,
                directwerkConfig,
                stagingCleanupService
        );
        handler.handle(job(new MediaStagingCleanupJobPayload("alpha/staging/sess/ep.mp3")));

        verify(stagingCleanupService).deleteStagingKeyAndFolder(
                "directwerk-dev",
                "alpha/staging/sess/ep.mp3"
        );
    }

    @Test
    void rejectsInvalidPayload() {
        MediaStagingCleanupJobHandler handler = new MediaStagingCleanupJobHandler(
                objectMapper,
                directwerkConfig,
                stagingCleanupService
        );

        assertThatThrownBy(() -> handler.handle(job(new MediaStagingCleanupJobPayload(" "))))
                .isInstanceOf(IllegalArgumentException.class);
    }

    private QueueJob job(MediaStagingCleanupJobPayload payload) {
        Instant now = Instant.now();
        return new QueueJob(
                UUID.randomUUID(),
                MediaJobQueueNames.MEDIA_STAGING_CLEANUP,
                objectMapper.valueToTree(payload),
                0,
                de.pnnit.directwerk.modules.queue.JobStatus.PROCESSING,
                now,
                1,
                8,
                "worker-1",
                now.plusSeconds(60),
                null,
                10L,
                null,
                null,
                now,
                now
        );
    }

    private static DirectwerkProperties.Storage storageProps() {
        return new DirectwerkProperties.Storage(
                true,
                "bunny",
                "de",
                "directwerk-dev",
                null,
                "https://de-s3.storage.bunnycdn.com",
                true,
                "zone",
                "password",
                "https://cdn.example.test",
                null,
                null,
                Duration.ofMinutes(15),
                Duration.ofHours(1),
                Duration.ofHours(24),
                24,
                3600000L,
                null,
                null
        );
    }
}
