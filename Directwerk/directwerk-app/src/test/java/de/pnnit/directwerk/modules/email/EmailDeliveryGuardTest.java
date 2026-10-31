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
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;

@ExtendWith(MockitoExtension.class)
class EmailDeliveryGuardTest {

    private static final Instant NOW = Instant.parse("2026-08-29T12:00:00Z");
    private static final UUID JOB_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");

    @Mock
    private EmailDeliveryRepository emailDeliveryRepository;

    @Mock
    private PlatformTransactionManager transactionManager;

    @Mock
    private de.pnnit.directwerk.config.DirectwerkConfig directwerkConfig;

    private EmailDeliveryGuard guard;

    @BeforeEach
    void setUp() {
        org.mockito.Mockito.lenient()
                .when(transactionManager.getTransaction(any()))
                .thenReturn(new SimpleTransactionStatus());
        org.mockito.Mockito.lenient()
                .when(directwerkConfig.queue())
                .thenReturn(new de.pnnit.directwerk.config.DirectwerkProperties.Queue(
                        true, 1000L, 10, 50, 60L, 300L, 3, 60L, 600L, 65536, "worker", 7L, 60000L, 100));
        guard = new EmailDeliveryGuard(
                emailDeliveryRepository,
                Clock.fixed(NOW, ZoneOffset.UTC),
                transactionManager,
                directwerkConfig);
    }

    @Test
    void claimLeaseIsDerivedFromTheQueueLease() {
        // Issue #326: with a 60s queue lease the takeover threshold is 30s before "now",
        // so a claim fenced 31s ago is stale but one fenced 5s ago is not.
        when(emailDeliveryRepository.insertIfAbsent(eq(JOB_ID), eq(NOW), any())).thenReturn(0);
        when(emailDeliveryRepository.takeOverStaleClaim(eq(JOB_ID), eq(NOW), eq(NOW.minusSeconds(30)), any()))
                .thenReturn(1);

        assertThat(guard.tryClaimDelivery(JOB_ID)).isPresent();
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
    void finalizeClaimKeepsClaimWhenPostSendFinalizeFails() {
        // #948: outbound already ran — treat as success so callers do not releaseClaim.
        UUID token = UUID.randomUUID();
        Runnable submission = org.mockito.Mockito.mock(Runnable.class);
        when(emailDeliveryRepository.findOwnedClaimForUpdate(JOB_ID, token))
                .thenReturn(Optional.of(new EmailDelivery()));
        when(emailDeliveryRepository.finalizeClaim(JOB_ID, token, NOW))
                .thenThrow(new RuntimeException("sent_at write failed"));

        assertThat(guard.finalizeClaim(
                new EmailDeliveryGuard.DeliveryClaim(JOB_ID, token), submission)).isTrue();

        verify(submission).run();
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
    void finalizeClaimSubmitsOutsideTheFencingTransactions() {
        UUID token = UUID.randomUUID();
        Runnable submission = org.mockito.Mockito.mock(Runnable.class);
        when(emailDeliveryRepository.findOwnedClaimForUpdate(JOB_ID, token))
                .thenReturn(Optional.of(new EmailDelivery()));
        when(emailDeliveryRepository.finalizeClaim(JOB_ID, token, NOW)).thenReturn(1);

        assertThat(guard.finalizeClaim(
                new EmailDeliveryGuard.DeliveryClaim(JOB_ID, token), submission)).isTrue();

        // Issue #325: fence -> submit -> finalize, so the outbound send is never inside the
        // transaction that held the row lock.
        InOrder order = org.mockito.Mockito.inOrder(emailDeliveryRepository, submission);
        order.verify(emailDeliveryRepository).findOwnedClaimForUpdate(JOB_ID, token);
        order.verify(submission).run();
        order.verify(emailDeliveryRepository).finalizeClaim(JOB_ID, token, NOW);
    }

    @Test
    void releaseClaimDeletesDeliveryRecord() {
        UUID token = UUID.randomUUID();
        guard.releaseClaim(new EmailDeliveryGuard.DeliveryClaim(JOB_ID, token));

        verify(emailDeliveryRepository).deleteClaim(JOB_ID, token);
    }
}
