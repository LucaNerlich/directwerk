package de.pnnit.directwerk.modules.email;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import de.pnnit.directwerk.modules.email.repository.EmailDeliveryRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class EmailDeliveryCleanupServiceTest {

    private static final Instant NOW = Instant.parse("2026-07-18T10:00:00Z");

    @Mock
    private EmailDeliveryRepository emailDeliveryRepository;

    @Mock
    private DirectwerkConfig directwerkConfig;

    private EmailDeliveryCleanupService cleanupService;

    @BeforeEach
    void setUp() {
        Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
        // Production wires `self` to the Spring-proxied bean so each deleteBatch() call commits
        // independently; deleteBatch() itself never touches `self`, so a plain (non-proxied)
        // delegate is behaviorally equivalent here.
        EmailDeliveryCleanupService deleteBatchDelegate =
                new EmailDeliveryCleanupService(emailDeliveryRepository, directwerkConfig, clock, null);
        cleanupService = new EmailDeliveryCleanupService(emailDeliveryRepository, directwerkConfig, clock, deleteBatchDelegate);
        when(directwerkConfig.email()).thenReturn(emailConfig(7L));
        when(directwerkConfig.queue()).thenReturn(queueConfig(50));
    }

    @Test
    void stopsAfterFirstPartialBatch() {
        when(emailDeliveryRepository.deleteOlderThan(any(), eq(50))).thenReturn(50, 12);

        int totalDeleted = cleanupService.cleanup();

        assertThat(totalDeleted).isEqualTo(62);
        verify(emailDeliveryRepository, times(2)).deleteOlderThan(any(), eq(50));
    }

    @Test
    void returnsZeroWhenNothingToDelete() {
        when(emailDeliveryRepository.deleteOlderThan(any(), eq(50))).thenReturn(0);

        int totalDeleted = cleanupService.cleanup();

        assertThat(totalDeleted).isZero();
        verify(emailDeliveryRepository, times(1)).deleteOlderThan(any(), eq(50));
    }

    @Test
    void usesCutoffDerivedFromRetentionDays() {
        when(emailDeliveryRepository.deleteOlderThan(any(), eq(50))).thenReturn(0);

        cleanupService.cleanup();

        verify(emailDeliveryRepository).deleteOlderThan(eq(NOW.minus(Duration.ofDays(7))), eq(50));
    }

    private static DirectwerkProperties.Email emailConfig(long retentionDays) {
        return new DirectwerkProperties.Email(
                "smtp",
                "noreply@directwerk.local",
                "Directwerk",
                "http://localhost:3004",
                "http://localhost:3001",
                "/accept-invite",
                "/reset-password",
                "/verify-email",
                retentionDays
        );
    }

    private static DirectwerkProperties.Queue queueConfig(int cleanupBatchSize) {
        return new DirectwerkProperties.Queue(
                true,
                1000L,
                10,
                100,
                60L,
                600L,
                5,
                30L,
                300L,
                65536,
                "test-worker",
                7L,
                60000L,
                cleanupBatchSize
        );
    }
}
