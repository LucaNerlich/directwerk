package de.pnnit.directwerk.modules.queue;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class QueueWorkerTest {

    @Test
    void pollDoesNothingWhenQueueDisabled() {
        QueueService queueService = mock(QueueService.class);
        JobHandlerRegistry registry = mock(JobHandlerRegistry.class);
        DirectwerkConfig config = configWithQueueEnabled(false);

        new QueueWorker(queueService, config, registry).poll("email");

        verifyNoInteractions(queueService);
    }

    @Test
    void pollDoesNothingWhenNoHandlerRegisteredForQueue() {
        QueueService queueService = mock(QueueService.class);
        JobHandlerRegistry registry = mock(JobHandlerRegistry.class);
        DirectwerkConfig config = configWithQueueEnabled(true);
        when(registry.handlerFor("unknown")).thenReturn(null);

        new QueueWorker(queueService, config, registry).poll("unknown");

        verifyNoInteractions(queueService);
    }

    @Test
    void pollAllPollsEveryRegisteredQueue() {
        QueueService queueService = mock(QueueService.class);
        JobHandlerRegistry registry = mock(JobHandlerRegistry.class);
        DirectwerkConfig config = configWithQueueEnabled(true);
        when(registry.registeredQueues()).thenReturn(Set.of("email", "content-notify"));
        when(registry.handlerFor("email")).thenReturn(null);
        when(registry.handlerFor("content-notify")).thenReturn(null);

        new QueueWorker(queueService, config, registry).pollAll();

        verify(registry).handlerFor("email");
        verify(registry).handlerFor("content-notify");
        verifyNoInteractions(queueService);
    }

    @Test
    void pollAllDoesNothingWhenQueueDisabled() {
        QueueService queueService = mock(QueueService.class);
        JobHandlerRegistry registry = mock(JobHandlerRegistry.class);
        DirectwerkConfig config = configWithQueueEnabled(false);

        new QueueWorker(queueService, config, registry).pollAll();

        verify(registry, never()).registeredQueues();
        verifyNoInteractions(queueService);
    }

    @Test
    void pollSkipsJobWhoseLeaseWasLostBeforeExecution() {
        QueueService queueService = mock(QueueService.class);
        JobHandlerRegistry registry = mock(JobHandlerRegistry.class);
        DirectwerkConfig config = configWithQueueEnabled(true);
        JobHandler handler = mock(JobHandler.class);
        when(registry.handlerFor("email")).thenReturn(handler);
        UUID jobId = UUID.randomUUID();
        Instant now = Instant.now();
        QueueJob job = new QueueJob(
                jobId, "email", null, 0, JobStatus.PROCESSING, now, 1, 5,
                "other-worker", now.plusSeconds(60), null, 1L, null, null, now, now);
        when(queueService.claim(eq("email"), anyString(), anyInt(), anyLong())).thenReturn(List.of(job));
        when(queueService.resolveLeaseSeconds(eq("email"), anyLong())).thenReturn(60L);
        when(queueService.renew(eq(jobId), anyString(), anyLong())).thenReturn(Optional.empty());

        new QueueWorker(queueService, config, registry).poll("email");

        // Issue #327: a job whose lease was already re-claimed must not run concurrently.
        verify(handler, never()).handle(any());
    }

    @Test
    void heartbeatReportsLeaseLossWhenRenewReturnsEmpty() {
        // Issue #583: renew signals a lost lease with Optional.empty() (never an exception), so
        // the heartbeat must check the result instead of relying on an unreachable catch.
        QueueService queueService = mock(QueueService.class);
        DirectwerkConfig config = configWithQueueEnabled(true);
        QueueJob job = new QueueJob(
                UUID.randomUUID(), "email", null, 0, JobStatus.PROCESSING, Instant.now(), 1, 5,
                "worker-1", Instant.now().plusSeconds(60), null, 1L, null, null,
                Instant.now(), Instant.now());
        when(queueService.renew(eq(job.id()), anyString(), eq(60L))).thenReturn(Optional.empty());
        QueueWorker worker = new QueueWorker(queueService, config, mock(JobHandlerRegistry.class));

        assertThat(worker.renewLeaseOnce(job, 60L)).isFalse();
    }

    @Test
    void heartbeatKeepsGoingWhenRenewSucceedsOrTheDatabaseBlips() {
        QueueService queueService = mock(QueueService.class);
        DirectwerkConfig config = configWithQueueEnabled(true);
        QueueJob job = new QueueJob(
                UUID.randomUUID(), "email", null, 0, JobStatus.PROCESSING, Instant.now(), 1, 5,
                "worker-1", Instant.now().plusSeconds(60), null, 1L, null, null,
                Instant.now(), Instant.now());
        when(queueService.renew(eq(job.id()), anyString(), eq(60L))).thenReturn(Optional.of(job));
        QueueWorker worker = new QueueWorker(queueService, config, mock(JobHandlerRegistry.class));
        assertThat(worker.renewLeaseOnce(job, 60L)).isTrue();

        when(queueService.renew(eq(job.id()), anyString(), eq(60L))).thenThrow(new IllegalStateException("db down"));
        assertThat(worker.renewLeaseOnce(job, 60L)).isTrue();
    }

    private static DirectwerkConfig configWithQueueEnabled(boolean enabled) {
        DirectwerkProperties.Queue queueProps = new DirectwerkProperties.Queue(
                enabled, 1000, 10, 100, 60, 3600, 5, 30, 3600, 10000, "test-worker", 7, 3600000, 100
        );
        DirectwerkProperties properties =
                new DirectwerkProperties(null, null, null, null, null, queueProps, null, null, null);
        return new DirectwerkConfig(properties);
    }
}
