package de.pnnit.directwerk.modules.content;

/**
 * Signals that durable RSS snapshots for a tenant should be regenerated.
 * Used by core (tenant identity, domain, RSS module activation) where a direct
 * dependency on the podcast job producer is not allowed.
 *
 * @param tenantId      the tenant whose snapshots are stale
 * @param previousSlug  the slug objects were stored under before a rename, or {@code null}
 */
public record TenantRssSnapshotStaleEvent(Long tenantId, String previousSlug) {

    public TenantRssSnapshotStaleEvent {
        if (tenantId == null || tenantId < 1) {
            throw new IllegalArgumentException("tenantId must be a positive id");
        }
        if (previousSlug != null && previousSlug.isBlank()) {
            throw new IllegalArgumentException("previousSlug must not be blank");
        }
    }

    public TenantRssSnapshotStaleEvent(Long tenantId) {
        this(tenantId, null);
    }
}
