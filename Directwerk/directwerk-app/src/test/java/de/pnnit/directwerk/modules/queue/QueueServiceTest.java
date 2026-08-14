package de.pnnit.directwerk.modules.queue;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

@ExtendWith(MockitoExtension.class)
class QueueServiceTest {

    @Mock
    private QueueRepository repository;

    @Mock
    private DirectwerkConfig directwerkConfig;

    @Mock
    private JobHandlerRegistry handlerRegistry;

    private QueueService queueService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        queueService = new QueueService(repository, directwerkConfig, handlerRegistry);
        lenient().when(handlerRegistry.isRegistered("email")).thenReturn(true);
        lenient().when(handlerRegistry.isRegistered("unknown")).thenReturn(false);
        lenient().when(handlerRegistry.settingsFor("email")).thenReturn(JobHandlerSettings.defaults());
        lenient().when(directwerkConfig.queue()).thenReturn(new DirectwerkProperties.Queue(
                true,
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
                7L,
                3600000L,
                1000
        ));
    }

    @Test
    void enqueueRejectsUnknownQueue() {
        ObjectNode payload = objectMapper.createObjectNode().put("x", 1);
        assertThatThrownBy(() -> queueService.enqueue("unknown", payload, 0, null, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("not allowed");
    }

    @Test
    void enqueueUsesDefaultMaxAttempts() {
        ObjectNode payload = objectMapper.createObjectNode().put("x", 1);
        Instant now = Instant.parse("2026-07-18T10:00:00Z");
        QueueJob job = sampleJob("email", payload, now);
        when(repository.enqueue(eq("email"), any(), eq(0), eq(null), eq(5), eq(null), eq(null), eq(null)))
                .thenReturn(job);

        QueueJob result = queueService.enqueue("email", payload, 0, null, null);

        assertThat(result.maxAttempts()).isEqualTo(5);
        verify(repository).enqueue("email", payload, 0, null, 5, null, null, null);
    }

    @Test
    void claimRejectsUnknownQueue() {
        assertThatThrownBy(() -> queueService.claim("unknown", "worker", 1, 60))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("not allowed");
    }

    @Test
    void claimRejectsLimitAboveConfiguredCeiling() {
        assertThatThrownBy(() -> queueService.claim("email", "worker", 11, 60))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("claim limit");
    }

    @Test
    void getThrowsWhenMissing() {
        UUID id = UUID.randomUUID();
        when(repository.find(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> queueService.get(id))
                .isInstanceOf(JobNotFoundException.class);
    }

    @Test
    void completeThrowsConflictWhenLeaseMissing() {
        UUID id = UUID.randomUUID();
        when(repository.complete(id, "worker")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> queueService.complete(id, "worker"))
                .isInstanceOf(JobConflictException.class);
    }

    @Test
    void failRejectsRetryDelayAboveCeiling() {
        UUID id = UUID.randomUUID();
        ObjectNode payload = objectMapper.createObjectNode();
        Instant now = Instant.parse("2026-07-18T10:00:00Z");
        when(repository.find(id)).thenReturn(Optional.of(sampleJob("email", payload, now)));

        assertThatThrownBy(() -> queueService.fail(id, "worker", "err", 9999999L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Retry delay");
    }

    @Test
    void failDelegatesWithDuration() {
        ObjectNode payload = objectMapper.createObjectNode();
        Instant now = Instant.parse("2026-07-18T10:00:00Z");
        UUID id = UUID.randomUUID();
        QueueJob job = new QueueJob(
                id,
                "email",
                payload,
                0,
                JobStatus.QUEUED,
                now,
                1,
                5,
                null,
                null,
                null,
                null,
                null,
                null,
                now,
                now
        );
        when(repository.find(id)).thenReturn(Optional.of(job));
        when(repository.fail(eq(id), eq("worker"), eq("err"), eq(Duration.ofSeconds(30)))).thenReturn(Optional.of(job));

        QueueJob result = queueService.fail(id, "worker", "err", 30L);

        assertThat(result.status()).isEqualTo(JobStatus.QUEUED);
    }

    @Test
    void listRejectsUnknownQueue() {
        assertThatThrownBy(() -> queueService.list(new JobListQuery("unknown", null, null, null, null, 0, 10)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("not allowed");
    }

    @Test
    void listRejectsLimitAboveConfiguredCeiling() {
        assertThatThrownBy(() -> queueService.list(new JobListQuery("email", null, null, null, null, 0, 101)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("list limit");
    }

    @Test
    void listAllowsPageSizeAboveClaimLimit() {
        JobListQuery query = new JobListQuery("email", null, null, null, null, 0, 20);
        JobListPage page = new JobListPage(List.of(), 0L, 0, 20);
        when(repository.list(query)).thenReturn(page);

        assertThat(queueService.list(query)).isSameAs(page);
    }

    @Test
    void listDelegatesToRepository() {
        JobListQuery query = new JobListQuery("email", JobStatus.QUEUED, null, null, null, 0, 10);
        JobListPage page = new JobListPage(List.of(), 0L, 0, 10);
        when(repository.list(query)).thenReturn(page);

        assertThat(queueService.list(query)).isSameAs(page);
    }

    private static QueueJob sampleJob(String queue, ObjectNode payload, Instant now) {
        return new QueueJob(
                UUID.randomUUID(),
                queue,
                payload,
                0,
                JobStatus.QUEUED,
                now,
                0,
                5,
                null,
                null,
                null,
                null,
                null,
                null,
                now,
                now
        );
    }
}
