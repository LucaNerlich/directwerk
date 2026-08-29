package de.pnnit.directwerk.modules.email;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.email.repository.EmailDeliveryRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class EmailDeliveryGuardTest {

    private static final Instant NOW = Instant.parse("2026-08-29T12:00:00Z");
    private static final UUID JOB_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");

    @Mock
    private EmailDeliveryRepository emailDeliveryRepository;

    private EmailDeliveryGuard guard;

    @BeforeEach
    void setUp() {
        guard = new EmailDeliveryGuard(emailDeliveryRepository, Clock.fixed(NOW, ZoneOffset.UTC));
    }

    @Test
    void tryClaimDeliveryReturnsTrueWhenInsertSucceeds() {
        when(emailDeliveryRepository.insertIfAbsent(JOB_ID, NOW)).thenReturn(1);

        assertThat(guard.tryClaimDelivery(JOB_ID)).isTrue();
    }

    @Test
    void tryClaimDeliveryReturnsFalseWhenAlreadyClaimed() {
        when(emailDeliveryRepository.insertIfAbsent(JOB_ID, NOW)).thenReturn(0);

        assertThat(guard.tryClaimDelivery(JOB_ID)).isFalse();
    }

    @Test
    void releaseClaimDeletesDeliveryRecord() {
        guard.releaseClaim(JOB_ID);

        verify(emailDeliveryRepository).deleteClaim(JOB_ID);
    }
}
