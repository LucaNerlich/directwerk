package de.pnnit.directwerk.modules.queue;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.util.StringUtils;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Repository
public class QueueRepository {

    private static final String COLUMNS = """
            id, queue_name, payload::text, priority, status::text, available_at,
            attempts, max_attempts, locked_by, locked_until, last_error,
            tenant_id, correlation_id, metadata::text,
            created_at, updated_at
            """;

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    /**
     * Creates a repository backed by JDBC and configured to parse job payloads as JSON.
     *
     * @param jdbcTemplate the JDBC template used to execute database operations
     * @param objectMapper the object mapper used to parse job payloads
     */
    public QueueRepository(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    /**
     * Enqueues a job with its payload, priority, availability time, and attempt limit.
     * When {@code correlationId} is set, an already-{@code QUEUED} job with the same
     * queue and correlation id is returned instead of inserting a duplicate.
     *
     * @param queue         the queue name
     * @param payload       the job payload
     * @param priority      the job priority
     * @param availableAt   the time when the job becomes available, or {@code null} to use the current time
     * @param maxAttempts   the maximum number of processing attempts
     * @return              the persisted queue job
     */
    public QueueJob enqueue(
            String queue,
            JsonNode payload,
            int priority,
            Instant availableAt,
            int maxAttempts,
            Long tenantId,
            String correlationId,
            JsonNode metadata
    ) {
        if (correlationId != null && tenantId == null) {
            throw new IllegalArgumentException("tenantId is required when correlationId is supplied");
        }
        if (correlationId == null) {
            return insert(queue, payload, priority, availableAt, maxAttempts, tenantId, null, metadata);
        }
        // Atomic dedup scoped by tenant: the partial unique index coalesces QUEUED jobs with the same
        // (queue, correlation, tenant). ON CONFLICT DO NOTHING never raises a statement error, so a
        // concurrent duplicate does not abort the transaction — we simply fall back to the
        // already-queued row in a fresh statement.
        Optional<QueueJob> inserted = insertIfAbsent(
                queue, payload, priority, availableAt, maxAttempts, tenantId, correlationId, metadata
        );
        if (inserted.isPresent()) {
            return inserted.get();
        }
        return findQueued(queue, tenantId, correlationId)
                .orElseThrow(() -> new IllegalStateException(
                        "Enqueue coalesced by correlation id but no QUEUED job found: queue=" + queue
                                + " correlation=" + correlationId));
    }

    /**
     * Returns the queued job for {@code queue} + {@code correlationId} + {@code tenantId}, if any.
     */
    public Optional<QueueJob> findQueued(String queue, Long tenantId, String correlationId) {
        if (correlationId == null) {
            return Optional.empty();
        }
        return jdbcTemplate.query("""
                SELECT %s
                FROM jobs
                WHERE queue_name = ?
                  AND correlation_id = ?
                  AND tenant_id = ?
                  AND status = 'QUEUED'
                LIMIT 1
                """.formatted(COLUMNS), this::mapJob, queue, correlationId, tenantId).stream().findFirst();
    }

    private Optional<QueueJob> insertIfAbsent(
            String queue,
            JsonNode payload,
            int priority,
            Instant availableAt,
            int maxAttempts,
            Long tenantId,
            String correlationId,
            JsonNode metadata
    ) {
        return jdbcTemplate.query("""
                INSERT INTO jobs(
                    queue_name, payload, priority, available_at, max_attempts,
                    tenant_id, correlation_id, metadata
                )
                VALUES (?, ?::jsonb, ?, COALESCE(CAST(? AS timestamptz), clock_timestamp()), ?,
                        ?, ?, ?::jsonb)
                ON CONFLICT (queue_name, correlation_id, tenant_id)
                    WHERE status = 'QUEUED' AND correlation_id IS NOT NULL
                DO NOTHING
                RETURNING %s
                """.formatted(COLUMNS), this::mapJob,
                queue,
                payload.toString(),
                priority,
                availableAt == null ? null : OffsetDateTime.ofInstant(availableAt, ZoneOffset.UTC),
                maxAttempts,
                tenantId,
                correlationId,
                metadata == null ? null : metadata.toString()).stream().findFirst();
    }

    private QueueJob insert(
            String queue,
            JsonNode payload,
            int priority,
            Instant availableAt,
            int maxAttempts,
            Long tenantId,
            String correlationId,
            JsonNode metadata
    ) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO jobs(
                    queue_name, payload, priority, available_at, max_attempts,
                    tenant_id, correlation_id, metadata
                )
                VALUES (?, ?::jsonb, ?, COALESCE(CAST(? AS timestamptz), clock_timestamp()), ?,
                        ?, ?, ?::jsonb)
                RETURNING %s
                """.formatted(COLUMNS), this::mapJob,
                queue,
                payload.toString(),
                priority,
                availableAt == null ? null : OffsetDateTime.ofInstant(availableAt, ZoneOffset.UTC),
                maxAttempts,
                tenantId,
                correlationId,
                metadata == null ? null : metadata.toString());
    }

    /**
     * Claims eligible jobs for a worker and leases them for processing.
     *
     * @param queue the queue from which jobs are claimed
     * @param worker the worker receiving the leases
     * @param limit the maximum number of jobs to claim
     * @param lease the duration of each job lease
     * @return jobs transitioned to processing and leased to the worker
     */
    public List<QueueJob> claim(String queue, String worker, int limit, Duration lease) {
        return jdbcTemplate.query("""
                WITH exhausted AS (
                    UPDATE jobs
                    SET status = 'FAILED',
                        locked_by = NULL,
                        locked_until = NULL,
                        last_error = COALESCE(last_error, 'Lease expired after maximum attempts.'),
                        updated_at = clock_timestamp()
                    WHERE queue_name = ?
                      AND status = 'PROCESSING'
                      AND locked_until <= clock_timestamp()
                      AND attempts >= max_attempts
                    RETURNING id
                ),
                candidates AS (
                    SELECT id
                    FROM jobs
                    WHERE queue_name = ?
                      AND attempts < max_attempts
                      AND (
                          (status = 'QUEUED' AND available_at <= clock_timestamp())
                          OR (status = 'PROCESSING' AND locked_until <= clock_timestamp())
                      )
                    ORDER BY priority DESC, available_at, id
                    FOR UPDATE SKIP LOCKED
                    LIMIT ?
                )
                UPDATE jobs j
                SET status = 'PROCESSING',
                    attempts = j.attempts + 1,
                    locked_by = ?,
                    locked_until = clock_timestamp() + (? * interval '1 millisecond'),
                    updated_at = clock_timestamp()
                FROM candidates c
                WHERE j.id = c.id
                RETURNING j.id, j.queue_name, j.payload::text, j.priority, j.status::text,
                          j.available_at, j.attempts, j.max_attempts, j.locked_by, j.locked_until,
                          j.last_error, j.tenant_id, j.correlation_id, j.metadata::text,
                          j.created_at, j.updated_at
                """, this::mapJob, queue, queue, limit, worker, lease.toMillis()).stream()
                .sorted(Comparator.comparingInt(QueueJob::priority).reversed()
                        .thenComparing(QueueJob::availableAt)
                        .thenComparing(QueueJob::id))
                .toList();
    }

    /**
     * Completes a processing job when the specified worker holds a valid lease.
     *
     * @param id     the job identifier
     * @param worker the worker holding the job lease
     * @return the completed job, or an empty optional if the job cannot be completed
     */
    public Optional<QueueJob> complete(UUID id, String worker) {
        return jdbcTemplate.query("""
                UPDATE jobs
                SET status = 'COMPLETED', locked_by = NULL, locked_until = NULL,
                    updated_at = clock_timestamp()
                WHERE id = ? AND status = 'PROCESSING' AND locked_by = ?
                  AND locked_until > clock_timestamp()
                RETURNING %s
                """.formatted(COLUMNS), this::mapJob, id, worker).stream().findFirst();
    }

    /**
     * Records a processing failure and either requeues the job for another attempt or marks it as failed.
     *
     * @param id the job identifier
     * @param worker the worker holding the job lease
     * @param error the error recorded for the job
     * @param retryDelay the delay before a requeued job becomes available
     * @return the updated job if the worker holds a valid lease; otherwise, an empty optional
     */
    public Optional<QueueJob> fail(UUID id, String worker, String error, Duration retryDelay) {
        return jdbcTemplate.query("""
                UPDATE jobs
                SET status = CASE WHEN attempts >= max_attempts THEN 'FAILED'::job_status
                                  ELSE 'QUEUED'::job_status END,
                    available_at = clock_timestamp() + (? * interval '1 millisecond'),
                    locked_by = NULL,
                    locked_until = NULL,
                    last_error = ?,
                    updated_at = clock_timestamp()
                WHERE id = ? AND status = 'PROCESSING' AND locked_by = ?
                  AND locked_until > clock_timestamp()
                RETURNING %s
                """.formatted(COLUMNS), this::mapJob,
                retryDelay.toMillis(), error, id, worker).stream().findFirst();
    }

    /**
     * Finds a queue job by its identifier.
     *
     * @param id the job identifier
     * @return the matching job, or an empty optional if no job exists with the identifier
     */
    public Optional<QueueJob> find(UUID id) {
        return jdbcTemplate.query(
                "SELECT %s FROM jobs WHERE id = ?".formatted(COLUMNS), this::mapJob, id
        ).stream().findFirst();
    }

    /**
     * Lists jobs matching the query filters in descending update order.
     *
     * @param query the filters and pagination settings
     * @return a page containing the matching jobs and total count
     */
    public JobListPage list(JobListQuery query) {
        StringBuilder where = new StringBuilder(" WHERE 1=1");
        List<Object> args = new ArrayList<>();
        appendListFilters(where, args, query);

        Long total = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM jobs" + where,
                Long.class,
                args.toArray()
        );

        List<Object> pageArgs = new ArrayList<>(args);
        pageArgs.add(query.limit());
        pageArgs.add(query.offset());
        List<QueueJob> items = jdbcTemplate.query(
                "SELECT %s FROM jobs%s ORDER BY updated_at DESC, id DESC LIMIT ? OFFSET ?"
                        .formatted(COLUMNS, where),
                this::mapJob,
                pageArgs.toArray()
        );
        return new JobListPage(items, total == null ? 0L : total, query.offset(), query.limit());
    }

    /**
     * Appends the query's queue, status, and update-time filters to a SQL predicate and adds their parameters.
     *
     * @param where the SQL predicate to extend
     * @param args the parameter values corresponding to the appended filters
     * @param query the job list filters to apply
     */
    private static void appendListFilters(StringBuilder where, List<Object> args, JobListQuery query) {
        if (StringUtils.hasText(query.queue())) {
            where.append(" AND queue_name = ?");
            args.add(query.queue().trim());
        }
        if (query.status() != null) {
            where.append(" AND status = ?::job_status");
            args.add(query.status().name());
        }
        if (query.tenantId() != null) {
            where.append(" AND tenant_id = ?");
            args.add(query.tenantId());
        }
        if (query.updatedAfter() != null) {
            where.append(" AND updated_at >= ?");
            args.add(OffsetDateTime.ofInstant(query.updatedAfter(), ZoneOffset.UTC));
        }
        if (query.updatedBefore() != null) {
            where.append(" AND updated_at < ?");
            args.add(OffsetDateTime.ofInstant(query.updatedBefore(), ZoneOffset.UTC));
        }
    }

    /**
     * Deletes all jobs from the queue.
     */
    public void clear() {
        jdbcTemplate.update("DELETE FROM jobs");
    }

    /**
     * Deletes up to {@code limit} terminal jobs ({@code COMPLETED}/{@code FAILED})
     * whose {@code updated_at} is strictly before {@code cutoff}.
     *
     * @return number of rows deleted
     */
    public int deleteTerminalJobsOlderThan(Instant cutoff, int limit) {
        List<UUID> deletedIds = jdbcTemplate.query("""
                WITH stale AS (
                    SELECT id
                    FROM jobs
                    WHERE status IN ('COMPLETED', 'FAILED')
                      AND updated_at < ?
                    ORDER BY updated_at, id
                    FOR UPDATE SKIP LOCKED
                    LIMIT ?
                )
                DELETE FROM jobs j
                USING stale s
                WHERE j.id = s.id
                RETURNING j.id
                """, (rs, rowNum) -> rs.getObject(1, UUID.class),
                OffsetDateTime.ofInstant(cutoff, ZoneOffset.UTC),
                limit);
        return deletedIds.size();
    }

    /**
     * Maps the current result-set row to a queue job.
     *
     * @param rs  the result set containing the job row
     * @param row the current row index
     * @return    the mapped queue job
     * @throws SQLException if the row contains invalid or unreadable job data
     */
    private QueueJob mapJob(ResultSet rs, int row) throws SQLException {
        try {
            OffsetDateTime lockedUntil = rs.getObject("locked_until", OffsetDateTime.class);
            String metadataText = rs.getString("metadata");
            JsonNode metadata = metadataText == null ? null : objectMapper.readTree(metadataText);
            return new QueueJob(
                    rs.getObject("id", UUID.class),
                    rs.getString("queue_name"),
                    objectMapper.readTree(rs.getString("payload")),
                    rs.getInt("priority"),
                    JobStatus.valueOf(rs.getString("status")),
                    rs.getObject("available_at", OffsetDateTime.class).toInstant(),
                    rs.getInt("attempts"),
                    rs.getInt("max_attempts"),
                    rs.getString("locked_by"),
                    lockedUntil == null ? null : lockedUntil.toInstant(),
                    rs.getString("last_error"),
                    rs.getObject("tenant_id", Long.class),
                    rs.getString("correlation_id"),
                    metadata,
                    rs.getObject("created_at", OffsetDateTime.class).toInstant(),
                    rs.getObject("updated_at", OffsetDateTime.class).toInstant()
            );
        } catch (RuntimeException exception) {
            throw new SQLException("Invalid job JSON", exception);
        }
    }
}
