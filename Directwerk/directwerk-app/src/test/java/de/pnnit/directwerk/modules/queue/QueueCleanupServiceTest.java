package de.pnnit.directwerk.modules.queue;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class QueueCleanupServiceTest {

    private static final Instant NOW = Instant.parse("2026-07-18T12:00:00Z");

    @Mock
    private QueueRepository queueRepository;

    @Mock
    private DirectwerkConfig directwerkConfig;

    private QueueCleanupService cleanupService;

    @BeforeEach
    void setUp() {
        cleanupService = new QueueCleanupService(
                queueRepository,
                directwerkConfig,
                Clock.fixed(NOW, ZoneOffset.UTC)
        );
    }

    @Test
    void skipsWhenQueueDisabled() {
        when(directwerkConfig.queue()).thenReturn(queueProperties(false, 7, 1000));

        assertThat(cleanupService.cleanup()).isZero();
        verify(queueRepository, never()).deleteTerminalJobsOlderThan(any(), anyInt());
    }

    @Test
    void deletesBatchesUntilShortPage() {
        when(directwerkConfig.queue()).thenReturn(queueProperties(true, 7, 2));
        Instant cutoff = NOW.minusSeconds(7L * 24 * 3600);
        when(queueRepository.deleteTerminalJobsOlderThan(eq(cutoff), eq(2)))
                .thenReturn(2)
                .thenReturn(2)
                .thenReturn(1);

        int deleted = cleanupService.cleanup();

        assertThat(deleted).isEqualTo(5);
        verify(queueRepository, times(3)).deleteTerminalJobsOlderThan(cutoff, 2);
    }

    private static DirectwerkProperties.Queue queueProperties(boolean enabled, long retentionDays, int batchSize) {
        return new DirectwerkProperties.Queue(
                enabled,
                5000L,
                10,
                100,
                60L,
                86400L,
                5,
                30L,
                604800L,
                100000,
                "test-worker",
                retentionDays,
                3600000L,
                batchSize
        );
    }
}
