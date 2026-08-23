package de.pnnit.directwerk.multitenancy.hibernate;

import de.pnnit.directwerk.multitenancy.TenantContext;
import de.pnnit.directwerk.multitenancy.TenantFilters;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Before;
import org.hibernate.Session;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Enables the Hibernate {@code tenantFilter} whenever a tenant context is present.
 *
 * <p>Contract: the filter can only be applied to the <em>transaction-bound</em>
 * session. This aspect therefore only takes effect when an enclosing
 * transaction (or the repository's own {@code @Transactional}) has already
 * opened one — outside any transaction, Spring's shared EntityManager proxy
 * hands out a throwaway session per operation and a filter enabled there is
 * lost. Every code path that touches {@code TenantOwned} entities must run
 * inside a transactional boundary; services that query repositories directly
 * should be annotated {@code @Transactional(readOnly = true)}.</p>
 */
@Aspect
@Component
@Order(200)
public class TenantHibernateFilterEnabler {

    @PersistenceContext
    private EntityManager entityManager;

    /**
     * Enables and configures the tenant filter for the current Hibernate session when a tenant is available.
     */
    @Before("@within(org.springframework.stereotype.Service) "
            + "|| execution(* org.springframework.data.repository.Repository+.*(..))")
    public void enableTenantFilter() {
        Long tenantId = TenantContext.getTenantId();
        if (tenantId == null || entityManager == null) {
            return;
        }
        Session session = entityManager.unwrap(Session.class);
        session.enableFilter(TenantFilters.FILTER_NAME)
                .setParameter(TenantFilters.PARAM_NAME, tenantId);
    }
}
