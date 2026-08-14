package de.pnnit.directwerk.controller.platform;

import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.modules.queue.JobEnqueueMetadata;
import de.pnnit.directwerk.modules.queue.JobListPage;
import de.pnnit.directwerk.modules.queue.JobListQuery;
import de.pnnit.directwerk.modules.queue.JobStatus;
import de.pnnit.directwerk.modules.queue.QueueJob;
import de.pnnit.directwerk.modules.queue.QueueService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;

/**
 * Platform-admin queue inspection and manual enqueue API.
 * <p>
 * Prefer typed producers (e.g. {@code EmailJobProducer}) for application flows: they validate payloads,
 * encrypt bearer tokens before persistence, and attach tenant metadata. Raw enqueue via this API bypasses
 * those safeguards and is intended for operational recovery only.
 */
@RestController
@Validated
@PreAuthorize("hasRole('PLATFORM_ADMIN')")
@RequestMapping("/api/v1/platform/queue/jobs")
public class PlatformQueueController {

    private final QueueService queueService;

    public PlatformQueueController(QueueService queueService) {
        this.queueService = queueService;
    }

    @PostMapping
    ResponseEntity<Response<QueueJob>> enqueue(@Valid @RequestBody EnqueueJobRequest request) {
        QueueJob job = queueService.enqueue(
                request.queue(),
                request.payload(),
                request.priority(),
                request.availableAt(),
                request.maxAttempts(),
                new JobEnqueueMetadata(request.tenantId(), request.correlationId(), request.metadata())
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(Response.created(job));
    }

    @GetMapping
    ResponseEntity<Response<List<QueueJob>>> list(
            @RequestParam(required = false) String queue,
            @RequestParam(required = false) JobStatus status,
            @RequestParam(required = false) Long tenantId,
            @RequestParam(required = false) Instant updatedAfter,
            @RequestParam(required = false) Instant updatedBefore,
            @RequestParam(defaultValue = "0") @Min(0) int offset,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int limit
    ) {
        JobListPage page = queueService.list(new JobListQuery(
                queue,
                status,
                tenantId,
                updatedAfter,
                updatedBefore,
                offset,
                limit
        ));
        return ResponseEntity.ok(Response.ok(
                page.items(),
                Map.of(
                        "total", page.total(),
                        "offset", page.offset(),
                        "limit", page.limit()
                )
        ));
    }

    @GetMapping("/{id}")
    ResponseEntity<Response<QueueJob>> get(@PathVariable UUID id) {
        return ResponseEntity.ok(Response.ok(queueService.get(id)));
    }

    @PostMapping("/claim")
    ResponseEntity<Response<List<QueueJob>>> claim(@Valid @RequestBody ClaimJobsRequest request) {
        return ResponseEntity.ok(Response.ok(
                queueService.claim(request.queue(), request.worker(), request.limit(), request.leaseSeconds())
        ));
    }

    @PostMapping("/{id}/complete")
    ResponseEntity<Response<QueueJob>> complete(
            @PathVariable UUID id,
            @Valid @RequestBody CompleteJobRequest request
    ) {
        return ResponseEntity.ok(Response.ok(queueService.complete(id, request.worker())));
    }

    @PostMapping("/{id}/fail")
    ResponseEntity<Response<QueueJob>> fail(
            @PathVariable UUID id,
            @Valid @RequestBody FailJobRequest request
    ) {
        return ResponseEntity.ok(Response.ok(
                queueService.fail(id, request.worker(), request.error(), request.retryDelaySeconds())
        ));
    }

    public record EnqueueJobRequest(
            @NotBlank @Size(max = 100) String queue,
            @NotNull JsonNode payload,
            int priority,
            Instant availableAt,
            @Min(1) @Max(100) Integer maxAttempts,
            Long tenantId,
            @Size(max = 200) String correlationId,
            JsonNode metadata
    ) {
    }

    public record ClaimJobsRequest(
            @NotBlank @Size(max = 100) String queue,
            @NotBlank @Size(max = 200) String worker,
            @Min(1) int limit,
            @Min(1) long leaseSeconds
    ) {
    }

    public record CompleteJobRequest(@NotBlank @Size(max = 200) String worker) {
    }

    public record FailJobRequest(
            @NotBlank @Size(max = 200) String worker,
            @NotBlank @Size(max = 10_000) String error,
            @Min(0) long retryDelaySeconds
    ) {
    }
}
