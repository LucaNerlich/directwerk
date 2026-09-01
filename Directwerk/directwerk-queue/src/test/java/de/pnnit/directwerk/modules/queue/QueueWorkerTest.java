package de.pnnit.directwerk.modules.queue;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import java.util.Set;
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

    private static DirectwerkConfig configWithQueueEnabled(boolean enabled) {
        DirectwerkProperties.Queue queueProps = new DirectwerkProperties.Queue(
                enabled, 1000, 10, 100, 60, 3600, 5, 30, 3600, 10000, "test-worker", 7, 3600000, 100
        );
        DirectwerkProperties properties =
                new DirectwerkProperties(null, null, null, null, null, queueProps, null, null, null);
        return new DirectwerkConfig(properties);
    }
}
