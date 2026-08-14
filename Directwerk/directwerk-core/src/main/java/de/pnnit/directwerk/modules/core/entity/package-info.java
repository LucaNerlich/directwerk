/**
 * Core JPA entities. Declares the shared Hibernate {@code tenantFilter} definition
 * so every {@code @Filter(name = "tenantFilter")} binding resolves at runtime.
 */
@FilterDef(
        name = TenantFilters.FILTER_NAME,
        parameters = @ParamDef(name = TenantFilters.PARAM_NAME, type = Long.class),
        defaultCondition = TenantFilters.CONDITION,
        // Apply to Session.get / findById so load-by-PK cannot bypass tenant isolation.
        applyToLoadByKey = true
)
package de.pnnit.directwerk.modules.core.entity;

import de.pnnit.directwerk.multitenancy.TenantFilters;
import org.hibernate.annotations.FilterDef;
import org.hibernate.annotations.ParamDef;
