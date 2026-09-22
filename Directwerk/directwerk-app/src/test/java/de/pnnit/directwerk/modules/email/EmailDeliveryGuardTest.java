package de.pnnit.directwerk.modules.email;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.email.repository.EmailDeliveryRepository;
import de.pnnit.directwerk.modules.email.entity.EmailDelivery;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.UUID;
import java.util.Optional;
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
        when(emailDeliveryRepository.insertIfAbsent(eq(JOB_ID), eq(NOW), any())).thenReturn(1);

        assertThat(guard.tryClaimDelivery(JOB_ID)).isPresent();
    }

    @Test
    void tryClaimDeliveryReturnsFalseWhenAlreadyClaimed() {
        when(emailDeliveryRepository.insertIfAbsent(eq(JOB_ID), eq(NOW), any())).thenReturn(0);

        assertThat(guard.tryClaimDelivery(JOB_ID)).isEmpty();
    }

    @Test
    void tryClaimDeliveryTakesOverStaleProvisionalClaim() {
        when(emailDeliveryRepository.insertIfAbsent(eq(JOB_ID), eq(NOW), any())).thenReturn(0);
        when(emailDeliveryRepository.takeOverStaleClaim(eq(JOB_ID), eq(NOW), any(), any())).thenReturn(1);

        assertThat(guard.tryClaimDelivery(JOB_ID)).isPresent();
    }

    @Test
    void finalizeClaimRecordsSentTimestamp() {
        UUID token = UUID.randomUUID();
        Runnable submission = org.mockito.Mockito.mock(Runnable.class);
        when(emailDeliveryRepository.findOwnedClaimForUpdate(JOB_ID, token))
                .thenReturn(Optional.of(new EmailDelivery()));
        when(emailDeliveryRepository.finalizeClaim(JOB_ID, token, NOW)).thenReturn(1);

        assertThat(guard.finalizeClaim(
                new EmailDeliveryGuard.DeliveryClaim(JOB_ID, token), submission)).isTrue();

        verify(submission).run();
        verify(emailDeliveryRepository).finalizeClaim(JOB_ID, token, NOW);
    }

    @Test
    void staleOwnerCannotSubmitAfterClaimWasReplaced() {
        UUID token = UUID.randomUUID();
        Runnable submission = org.mockito.Mockito.mock(Runnable.class);
        when(emailDeliveryRepository.findOwnedClaimForUpdate(JOB_ID, token)).thenReturn(Optional.empty());

        assertThat(guard.finalizeClaim(
                new EmailDeliveryGuard.DeliveryClaim(JOB_ID, token), submission)).isFalse();

        verify(submission, org.mockito.Mockito.never()).run();
    }

    @Test
    void releaseClaimDeletesDeliveryRecord() {
        UUID token = UUID.randomUUID();
        guard.releaseClaim(new EmailDeliveryGuard.DeliveryClaim(JOB_ID, token));

        verify(emailDeliveryRepository).deleteClaim(JOB_ID, token);
    }
}
