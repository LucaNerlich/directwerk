package de.pnnit.directwerk.multitenancy;

import java.util.function.Supplier;

/**
 * Request/job-scoped tenant holder. Cleared in {@code finally} by HTTP filters and queue workers.
 */
public final class TenantContext {

    private static final ThreadLocal<Long> TENANT_ID = new ThreadLocal<>();

    private TenantContext() {
    }

    /**
     * Sets the tenant identifier for the current thread.
     *
     * @param tenantId the tenant identifier, or {@code null} to clear the tenant value
     */
    public static void setTenantId(Long tenantId) {
        TENANT_ID.set(tenantId);
    }

    /**
     * Retrieves the tenant identifier associated with the current thread.
     *
     * @return the current tenant identifier, or {@code null} if no tenant is set
     */
    public static Long getTenantId() {
        return TENANT_ID.get();
    }

    /**
     * Retrieves the current tenant identifier or throws an exception when no tenant is active.
     *
     * @return the current tenant identifier
     * @throws TenantContextMissingException if no tenant identifier is set
     */
    public static Long requireTenantId() {
        Long tenantId = getTenantId();
        if (tenantId == null) {
            throw new TenantContextMissingException();
        }
        return tenantId;
    }

    /**
     * Clears the tenant associated with the current thread.
     */
    public static void clear() {
        TENANT_ID.remove();
    }

    /**
     * Executes an action without an active tenant context and restores the previous context afterward.
     *
     * @param action the action to execute
     * @param <T>    the result type
     * @return the value produced by the action
     */
    public static <T> T callWithoutTenant(Supplier<T> action) {
        Long previous = TENANT_ID.get();
        TENANT_ID.remove();
        try {
            return action.get();
        } finally {
            if (previous != null) {
                TENANT_ID.set(previous);
            } else {
                TENANT_ID.remove();
            }
        }
    }

    /**
     * Runs an action without an active tenant and restores the previous tenant afterward.
     *
     * @param action the action to execute
     */
    public static void runWithoutTenant(Runnable action) {
        callWithoutTenant(() -> {
            action.run();
            return null;
        });
    }

    /**
     * Executes an action within the specified tenant context and restores the previous context afterward.
     *
     * @param tenantId the tenant identifier to use, or {@code null} for no tenant
     * @param action   the action to execute
     * @param <T>      the result type
     * @return the value produced by {@code action}
     */
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

    /**
     * Runs an action with the specified tenant associated with the current thread.
     *
     * @param tenantId the tenant identifier to associate with the action
     * @param action   the action to run
     */
    public static void runWithTenant(Long tenantId, Runnable action) {
        callWithTenant(tenantId, () -> {
            action.run();
            return null;
        });
    }
}
