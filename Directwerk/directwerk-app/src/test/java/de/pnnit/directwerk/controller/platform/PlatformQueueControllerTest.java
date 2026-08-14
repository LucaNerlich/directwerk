package de.pnnit.directwerk.controller.platform;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.modules.queue.JobEnqueueMetadata;
import de.pnnit.directwerk.modules.queue.JobListPage;
import de.pnnit.directwerk.modules.queue.JobListQuery;
import de.pnnit.directwerk.modules.queue.JobStatus;
import de.pnnit.directwerk.modules.queue.QueueJob;
import de.pnnit.directwerk.modules.queue.QueueService;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

@ExtendWith(MockitoExtension.class)
class PlatformQueueControllerTest {

    @Mock
    private QueueService queueService;

    private PlatformQueueController controller;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        controller = new PlatformQueueController(queueService);
    }

    @Test
    void enqueueReturnsCreated() {
        ObjectNode payload = objectMapper.createObjectNode().put("to", "a@example.com");
        QueueJob job = sampleJob(payload);
        when(queueService.enqueue(eq("email"), any(), eq(10), isNull(), eq(3), any(JobEnqueueMetadata.class)))
                .thenReturn(job);

        ResponseEntity<Response<QueueJob>> response = controller.enqueue(
                new PlatformQueueController.EnqueueJobRequest("email", payload, 10, null, 3, null, null, null)
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().data().id()).isEqualTo(job.id());
        verify(queueService).enqueue(eq("email"), eq(payload), eq(10), isNull(), eq(3), any(JobEnqueueMetadata.class));
    }

    @Test
    void claimReturnsJobs() {
        ObjectNode payload = objectMapper.createObjectNode().put("to", "a@example.com");
        QueueJob job = sampleJob(payload);
        when(queueService.claim("email", "worker-1", 5, 60L)).thenReturn(List.of(job));

        ResponseEntity<Response<List<QueueJob>>> response = controller.claim(
                new PlatformQueueController.ClaimJobsRequest("email", "worker-1", 5, 60L)
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().data()).hasSize(1);
    }

    @Test
    void completeDelegatesToService() {
        ObjectNode payload = objectMapper.createObjectNode();
        QueueJob job = sampleJob(payload);
        when(queueService.complete(job.id(), "worker-1")).thenReturn(job);

        ResponseEntity<Response<QueueJob>> response = controller.complete(
                job.id(),
                new PlatformQueueController.CompleteJobRequest("worker-1")
        );

        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().data().status()).isEqualTo(JobStatus.QUEUED);
        verify(queueService).complete(job.id(), "worker-1");
    }

    @Test
    void failDelegatesToService() {
        ObjectNode payload = objectMapper.createObjectNode();
        QueueJob job = sampleJob(payload);
        when(queueService.fail(eq(job.id()), eq("worker-1"), eq("boom"), anyLong())).thenReturn(job);

        ResponseEntity<Response<QueueJob>> response = controller.fail(
                job.id(),
                new PlatformQueueController.FailJobRequest("worker-1", "boom", 30L)
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        verify(queueService).fail(job.id(), "worker-1", "boom", 30L);
    }

    @Test
    void getDelegatesToService() {
        ObjectNode payload = objectMapper.createObjectNode();
        QueueJob job = sampleJob(payload);
        when(queueService.get(job.id())).thenReturn(job);

        ResponseEntity<Response<QueueJob>> response = controller.get(job.id());

        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().data().id()).isEqualTo(job.id());
        verify(queueService).get(job.id());
    }

    @Test
    void listReturnsItemsWithPaginationMetadata() {
        ObjectNode payload = objectMapper.createObjectNode();
        QueueJob job = sampleJob(payload);
        Instant after = Instant.parse("2026-07-18T09:00:00Z");
        when(queueService.list(any(JobListQuery.class))).thenReturn(new JobListPage(List.of(job), 42L, 0, 20));

        ResponseEntity<Response<List<QueueJob>>> response = controller.list(
                "email",
                JobStatus.FAILED,
                1L,
                after,
                null,
                0,
                20
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().data()).containsExactly(job);
        assertThat(response.getBody().metadata()).containsEntry("total", 42L);
        verify(queueService).list(new JobListQuery("email", JobStatus.FAILED, 1L, after, null, 0, 20));
    }

    private static QueueJob sampleJob(ObjectNode payload) {
        Instant now = Instant.parse("2026-07-18T10:00:00Z");
        return new QueueJob(
                UUID.fromString("8f1e6b2a-0000-4000-8000-000000000001"),
                "email",
                payload,
                10,
                JobStatus.QUEUED,
                now,
                0,
                3,
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
