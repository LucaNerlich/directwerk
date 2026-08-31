package de.pnnit.directwerk.multitenancy;

import java.util.function.Supplier;

/**
 * Request/job-scoped tenant holder. Cleared in {@code finally} by HTTP filters and queue workers.
 */
public final class TenantContext {

    private static final ThreadLocal<Long> TENANT_ID = new ThreadLocal<>();

    private TenantContext() {
    }

    public static void setTenantId(Long tenantId) {
        TENANT_ID.set(tenantId);
    }

    public static Long getTenantId() {
        return TENANT_ID.get();
    }

    public static Long requireTenantId() {
        Long tenantId = getTenantId();
        if (tenantId == null) {
            throw new TenantContextMissingException();
        }
        return tenantId;
    }

    public static void clear() {
        TENANT_ID.remove();
    }

    /** Runs {@code action} with no active tenant, restoring whatever was set before on the way out. */
    public static <T> T callWithoutTenant(Supplier<T> action) {
        return callWithTenant(null, action);
    }

    /** Runs {@code action} with {@code tenantId} active (or none, if {@code null}), restoring the previous value afterward. */
    public static <T> T callWithTenant(Long tenantId, Supplier<T> action) {
        Long previous = TENANT_ID.get();
        try {
            if (tenantId == null) {
                TENANT_ID.remove();
            } else {
                TENANT_ID.set(tenantId);
            }
            return action.get();
        } finally {
            if (previous != null) {
                TENANT_ID.set(previous);
            } else {
                TENANT_ID.remove();
            }
        }
    }

    public static void runWithTenant(Long tenantId, Runnable action) {
        callWithTenant(tenantId, () -> {
            action.run();
            return null;
        });
    }
}
