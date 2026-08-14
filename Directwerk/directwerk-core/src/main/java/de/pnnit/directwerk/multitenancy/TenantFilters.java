package de.pnnit.directwerk.multitenancy;

/**
 * Hibernate filter name/parameter constants for shared-schema tenant isolation.
 * {@code @FilterDef} is declared in {@code de.pnnit.directwerk.modules.core.entity.package-info}.
 */
public final class TenantFilters {

    public static final String FILTER_NAME = "tenantFilter";
    public static final String PARAM_NAME = "tenantId";
    public static final String CONDITION = "tenant_id = :" + PARAM_NAME;

    private TenantFilters() {
    }
}
