package de.pnnit.directwerk.modules.queue;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import de.pnnit.directwerk.multitenancy.TenantContext;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.node.JsonNodeFactory;

class QueueWorkerTenantContextTest {

    @AfterEach
    void clear() {
        TenantContext.clear();
    }

    @Test
    void restoresTenantContextWhileHandlingJob() {
        QueueService queueService = mock(QueueService.class);
        JobHandlerRegistry registry = mock(JobHandlerRegistry.class);
        DirectwerkProperties.Queue queueProps = new DirectwerkProperties.Queue(
                true, 1000, 10, 100, 60, 3600, 5, 30, 3600, 10000, "test-worker", 7, 3600000, 100
        );
        DirectwerkProperties properties = new DirectwerkProperties(null, null, null, null, null, queueProps, null, null);
        DirectwerkConfig config = new DirectwerkConfig(properties);

        AtomicReference<Long> seenTenantId = new AtomicReference<>();
        JobHandler handler = new JobHandler() {
            @Override
            public String queueName() {
                return "email";
            }

            @Override
            public void handle(QueueJob job) {
                seenTenantId.set(TenantContext.getTenantId());
            }
        };

        when(registry.registeredQueues()).thenReturn(Set.of("email"));
        when(registry.handlerFor("email")).thenReturn(handler);
        when(queueService.resolveLeaseSeconds(eq("email"), org.mockito.ArgumentMatchers.anyLong())).thenReturn(60L);
        UUID jobId = UUID.randomUUID();
        QueueJob job = new QueueJob(
                jobId,
                "email",
                JsonNodeFactory.instance.objectNode(),
                0,
                JobStatus.PROCESSING,
                Instant.now(),
                1,
                5,
                "test-worker",
                Instant.now().plusSeconds(60),
                null,
                42L,
                null,
                null,
                Instant.now(),
                Instant.now()
        );
        when(queueService.claim("email", "test-worker", 10, 60)).thenReturn(List.of(job));

        QueueWorker worker = new QueueWorker(queueService, config, registry);
        worker.poll("email");

        assertThat(seenTenantId.get()).isEqualTo(42L);
        assertThat(TenantContext.getTenantId()).isNull();
        verify(queueService).complete(jobId, "test-worker");
    }
}
