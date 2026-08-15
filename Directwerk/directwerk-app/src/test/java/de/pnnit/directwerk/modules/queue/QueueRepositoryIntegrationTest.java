package de.pnnit.directwerk.modules.queue;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

@SpringBootTest
@Testcontainers(disabledWithoutDocker = true)
@ActiveProfiles("flyway-validate")
class QueueRepositoryIntegrationTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:19beta2-alpine");

    @Autowired
    private QueueRepository queueRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    @DynamicPropertySource
    static void registerSecrets(DynamicPropertyRegistry registry) {
        registry.add("directwerk.security.platform-client-secret", () -> "test-platform-" + UUID.randomUUID());
        registry.add("directwerk.security.tenant-client-secret", () -> "test-tenant-" + UUID.randomUUID());
        registry.add("directwerk.queue.enabled", () -> "false");
        registry.add("spring.quartz.auto-startup", () -> "false");
    }

    @BeforeEach
    void clearJobs() {
        queueRepository.clear();
        jdbcTemplate.update("INSERT INTO tenants (id, slug, name) VALUES (10, 'tenant-10', 'Tenant 10') ON CONFLICT (id) DO NOTHING");
        jdbcTemplate.update("INSERT INTO tenants (id, slug, name) VALUES (20, 'tenant-20', 'Tenant 20') ON CONFLICT (id) DO NOTHING");
    }

    @Test
    void claimOrdersByPriorityThenAvailability() {
        enqueue("mail", 1, Instant.now().minusSeconds(10));
        QueueJob high = enqueue("mail", 10, Instant.now().minusSeconds(5));
        enqueue("mail", 5, Instant.now().minusSeconds(1));

        List<QueueJob> claimed = queueRepository.claim("mail", "worker-1", 3, Duration.ofSeconds(60));

        assertThat(claimed).hasSize(3);
        assertThat(claimed.getFirst().id()).isEqualTo(high.id());
        assertThat(claimed.getFirst().priority()).isEqualTo(10);
        assertThat(claimed).allMatch(job -> job.status() == JobStatus.PROCESSING);
        assertThat(claimed).allMatch(job -> "worker-1".equals(job.lockedBy()));
    }

    @Test
    void concurrentWorkersNeverClaimTheSameJob() throws Exception {
        for (int i = 0; i < 20; i++) {
            enqueue("mail", i, Instant.now());
        }

        int workers = 4;
        ExecutorService executor = Executors.newFixedThreadPool(workers);
        try {
            CountDownLatch start = new CountDownLatch(1);
            List<Future<List<QueueJob>>> futures = new ArrayList<>();
            for (int i = 0; i < workers; i++) {
                String worker = "worker-" + i;
                futures.add(executor.submit(() -> {
                    start.await(5, TimeUnit.SECONDS);
                    return queueRepository.claim("mail", worker, 20, Duration.ofSeconds(60));
                }));
            }
            start.countDown();

            List<UUID> claimedIds = new ArrayList<>();
            for (Future<List<QueueJob>> future : futures) {
                claimedIds.addAll(future.get(10, TimeUnit.SECONDS).stream().map(QueueJob::id).toList());
            }

            assertThat(claimedIds).hasSize(20);
            Set<UUID> unique = claimedIds.stream().collect(Collectors.toSet());
            assertThat(unique).hasSize(20);
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    void failRequeuesUntilMaxAttemptsThenMarksFailed() {
        enqueue("mail", 0, Instant.now(), 2);
        List<QueueJob> claimed = queueRepository.claim("mail", "worker-1", 1, Duration.ofSeconds(60));
        assertThat(claimed).hasSize(1);

        QueueJob retried = queueRepository.fail(
                claimed.getFirst().id(),
                "worker-1",
                "SMTP timeout",
                Duration.ofSeconds(0)
        ).orElseThrow();
        assertThat(retried.status()).isEqualTo(JobStatus.QUEUED);
        assertThat(retried.lastError()).isEqualTo("SMTP timeout");

        List<QueueJob> secondClaim = queueRepository.claim("mail", "worker-1", 1, Duration.ofSeconds(60));
        assertThat(secondClaim).hasSize(1);
        assertThat(secondClaim.getFirst().attempts()).isEqualTo(2);

        QueueJob failed = queueRepository.fail(
                secondClaim.getFirst().id(),
                "worker-1",
                "SMTP timeout again",
                Duration.ofSeconds(0)
        ).orElseThrow();
        assertThat(failed.status()).isEqualTo(JobStatus.FAILED);
        assertThat(failed.attempts()).isEqualTo(2);
    }

    @Test
    void completeClearsLease() {
        enqueue("mail", 0, Instant.now());
        QueueJob claimed = queueRepository.claim("mail", "worker-1", 1, Duration.ofSeconds(60)).getFirst();

        QueueJob completed = queueRepository.complete(claimed.id(), "worker-1").orElseThrow();

        assertThat(completed.status()).isEqualTo(JobStatus.COMPLETED);
        assertThat(completed.lockedBy()).isNull();
        assertThat(completed.lockedUntil()).isNull();
    }

    @Test
    void delayedAvailableAtIsNotClaimedEarly() {
        enqueue("mail", 0, Instant.now().plusSeconds(3600));

        List<QueueJob> claimed = queueRepository.claim("mail", "worker-1", 1, Duration.ofSeconds(60));

        assertThat(claimed).isEmpty();
    }

    @Test
    void wrongWorkerCannotComplete() {
        enqueue("mail", 0, Instant.now());
        QueueJob claimed = queueRepository.claim("mail", "worker-1", 1, Duration.ofSeconds(60)).getFirst();

        assertThat(queueRepository.complete(claimed.id(), "other-worker")).isEmpty();
    }

    @Test
    void listFiltersByQueueStatusAndUpdatedWindowWithPagination() {
        QueueJob toFail = enqueue("email", 0, Instant.now().minusSeconds(30), 1);
        QueueJob claimed = queueRepository.claim("email", "worker-1", 1, Duration.ofSeconds(60)).getFirst();
        assertThat(claimed.id()).isEqualTo(toFail.id());
        queueRepository.fail(toFail.id(), "worker-1", "smtp", Duration.ZERO);

        QueueJob stillQueued = enqueue("email", 0, Instant.now());
        enqueue("other", 0, Instant.now());

        Instant after = Instant.now().minus(Duration.ofHours(1));
        JobListPage failedEmail = queueRepository.list(new JobListQuery(
                "email",
                JobStatus.FAILED,
                null,
                after,
                Instant.now().plusSeconds(5),
                0,
                10
        ));
        assertThat(failedEmail.total()).isEqualTo(1);
        assertThat(failedEmail.items()).extracting(QueueJob::id).containsExactly(toFail.id());

        JobListPage queuedEmail = queueRepository.list(new JobListQuery(
                "email",
                JobStatus.QUEUED,
                null,
                null,
                null,
                0,
                10
        ));
        assertThat(queuedEmail.total()).isEqualTo(1);
        assertThat(queuedEmail.items()).extracting(QueueJob::id).containsExactly(stillQueued.id());

        JobListPage firstPage = queueRepository.list(new JobListQuery("email", null, null, null, null, 0, 1));
        JobListPage secondPage = queueRepository.list(new JobListQuery("email", null, null, null, null, 1, 1));
        assertThat(firstPage.total()).isEqualTo(2);
        assertThat(firstPage.items()).hasSize(1);
        assertThat(secondPage.items()).hasSize(1);
        assertThat(secondPage.items().getFirst().id()).isNotEqualTo(firstPage.items().getFirst().id());
    }

    @Test
    void deleteTerminalJobsOlderThanRemovesStaleCompletedAndFailedOnly() {
        QueueJob recent = enqueue("mail", 0, Instant.now());
        queueRepository.claim("mail", "worker-1", 1, Duration.ofSeconds(60));
        queueRepository.complete(recent.id(), "worker-1");

        QueueJob staleCompleted = enqueue("mail", 0, Instant.now());
        queueRepository.claim("mail", "worker-1", 1, Duration.ofSeconds(60));
        queueRepository.complete(staleCompleted.id(), "worker-1");
        ageJob(staleCompleted.id(), Instant.now().minus(Duration.ofDays(10)));

        QueueJob staleFailed = enqueue("mail", 0, Instant.now(), 1);
        queueRepository.claim("mail", "worker-1", 1, Duration.ofSeconds(60));
        queueRepository.fail(staleFailed.id(), "worker-1", "boom", Duration.ZERO);
        ageJob(staleFailed.id(), Instant.now().minus(Duration.ofDays(10)));

        QueueJob stillQueued = enqueue("mail", 0, Instant.now());
        ageJob(stillQueued.id(), Instant.now().minus(Duration.ofDays(10)));

        int deleted = queueRepository.deleteTerminalJobsOlderThan(
                Instant.now().minus(Duration.ofDays(7)),
                100
        );

        assertThat(deleted).isEqualTo(2);
        assertThat(queueRepository.find(staleCompleted.id())).isEmpty();
        assertThat(queueRepository.find(staleFailed.id())).isEmpty();
        assertThat(queueRepository.find(recent.id())).isPresent();
        assertThat(queueRepository.find(stillQueued.id())).isPresent();
    }

    @Test
    void enqueueWithSameCorrelationIdDoesNotCreateASecondQueuedJob() {
        ObjectNode payload = objectMapper.createObjectNode().put("tenantId", 10);
        QueueJob first = queueRepository.enqueue(
                "mail", payload, 0, Instant.now(), 3, 10L, "rss-feed-refresh-10", null
        );
        QueueJob second = queueRepository.enqueue(
                "mail", payload, 0, Instant.now(), 3, 10L, "rss-feed-refresh-10", null
        );

        assertThat(second.id()).isEqualTo(first.id());
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM jobs WHERE correlation_id = ?",
                Integer.class,
                "rss-feed-refresh-10"
        )).isEqualTo(1);
    }

    @Test
    void enqueueWithSameCorrelationIdDifferentTenantsCreatesSeparateJobs() {
        ObjectNode payload = objectMapper.createObjectNode().put("tenantId", 10);
        QueueJob first = queueRepository.enqueue(
                "mail", payload, 0, Instant.now(), 3, 10L, "rss-feed-refresh", null
        );
        QueueJob second = queueRepository.enqueue(
                "mail", payload, 0, Instant.now(), 3, 20L, "rss-feed-refresh", null
        );

        assertThat(second.id()).isNotEqualTo(first.id());
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM jobs WHERE correlation_id = ?",
                Integer.class,
                "rss-feed-refresh"
        )).isEqualTo(2);
    }

    @Test
    void enqueueAllowsAFollowUpWhileAMatchingJobIsProcessing() {
        ObjectNode payload = objectMapper.createObjectNode().put("tenantId", 10);
        QueueJob first = queueRepository.enqueue(
                "mail", payload, 0, Instant.now(), 3, 10L, "rss-feed-refresh-10", null
        );
        List<QueueJob> claimed = queueRepository.claim("mail", "worker-1", 1, Duration.ofSeconds(60));
        assertThat(claimed).extracting(QueueJob::id).containsExactly(first.id());

        QueueJob followUp = queueRepository.enqueue(
                "mail", payload, 0, Instant.now(), 3, 10L, "rss-feed-refresh-10", null
        );

        assertThat(followUp.id()).isNotEqualTo(first.id());
        assertThat(followUp.status()).isEqualTo(JobStatus.QUEUED);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM jobs WHERE correlation_id = ?",
                Integer.class,
                "rss-feed-refresh-10"
        )).isEqualTo(2);
    }

    @Test
    void concurrentEnqueuesWithSameCorrelationIdCoalesceToOneJob() throws Exception {
        ObjectNode payload = objectMapper.createObjectNode().put("tenantId", 10);
        int workers = 8;
        ExecutorService executor = Executors.newFixedThreadPool(workers);
        try {
            CountDownLatch start = new CountDownLatch(1);
            List<Future<QueueJob>> futures = new ArrayList<>();
            for (int i = 0; i < workers; i++) {
                futures.add(executor.submit(() -> {
                    start.await(5, TimeUnit.SECONDS);
                    return queueRepository.enqueue(
                            "mail", payload, 0, Instant.now(), 3, 10L, "rss-feed-refresh-10", null
                    );
                }));
            }
            start.countDown();

            Set<UUID> ids = new java.util.HashSet<>();
            for (Future<QueueJob> future : futures) {
                ids.add(future.get(10, TimeUnit.SECONDS).id());
            }
            assertThat(ids).hasSize(1);
            assertThat(jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM jobs WHERE correlation_id = ?",
                    Integer.class,
                    "rss-feed-refresh-10"
            )).isEqualTo(1);
        } finally {
            executor.shutdownNow();
        }
    }

    private void ageJob(UUID id, Instant updatedAt) {
        jdbcTemplate.update(
                "UPDATE jobs SET updated_at = ? WHERE id = ?",
                OffsetDateTime.ofInstant(updatedAt, ZoneOffset.UTC),
                id
        );
    }

    private QueueJob enqueue(String queue, int priority, Instant availableAt) {
        return enqueue(queue, priority, availableAt, 3);
    }

    private QueueJob enqueue(String queue, int priority, Instant availableAt, int maxAttempts) {
        ObjectNode payload = objectMapper.createObjectNode();
        payload.put("to", "a@example.com");
        return queueRepository.enqueue(queue, payload, priority, availableAt, maxAttempts, null, null, null);
    }
}
