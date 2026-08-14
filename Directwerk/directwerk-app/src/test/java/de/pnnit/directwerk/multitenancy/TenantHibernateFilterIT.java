package de.pnnit.directwerk.multitenancy;

import static org.assertj.core.api.Assertions.assertThat;

import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.entity.TenantStatus;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.subscription.entity.OfferingType;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionProduct;
import de.pnnit.directwerk.modules.subscription.repository.SubscriptionProductRepository;
import jakarta.persistence.EntityManager;
import java.util.UUID;
import org.hibernate.Session;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest
@Testcontainers(disabledWithoutDocker = true)
@ActiveProfiles("flyway-validate")
class TenantHibernateFilterIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:19beta2-alpine");

    @Autowired
    private TenantRepository tenantRepository;

    @Autowired
    private SubscriptionProductRepository subscriptionProductRepository;

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private TransactionTemplate transactionTemplate;

    /**
     * Registers dynamic application properties required by the integration test environment.
     *
     * @param registry the registry for runtime application properties
     */
    @DynamicPropertySource
    static void registerSecrets(DynamicPropertyRegistry registry) {
        registry.add("directwerk.security.platform-client-secret", () -> "test-platform-" + UUID.randomUUID());
        registry.add("directwerk.security.tenant-client-secret", () -> "test-tenant-" + UUID.randomUUID());
        registry.add("directwerk.queue.enabled", () -> "false");
        registry.add("spring.quartz.auto-startup", () -> "false");
    }

    /**
     * Clears the tenant context after each test.
     */
    @AfterEach
    void clearContext() {
        TenantContext.clear();
    }

    @Test
    void findByIdDoesNotLeakAcrossTenantsWhenFilterEnabled() {
        Tenant tenantA = saveTenant("filter-a-" + suffix());
        Tenant tenantB = saveTenant("filter-b-" + suffix());

        SubscriptionProduct productB = new SubscriptionProduct();
        productB.setTenant(tenantB);
        productB.setSlug("cross-tenant-" + suffix());
        productB.setTitle("Other Tenant Product");
        productB.setOfferingType(OfferingType.LEVEL);
        productB.setSortOrder(1);
        productB.setActive(true);
        Long foreignId = transactionTemplate.execute(status ->
                subscriptionProductRepository.saveAndFlush(productB).getId()
        );

        Boolean leaked = transactionTemplate.execute(status -> {
            Session session = entityManager.unwrap(Session.class);
            session.enableFilter(TenantFilters.FILTER_NAME)
                    .setParameter(TenantFilters.PARAM_NAME, tenantA.getId());
            return subscriptionProductRepository.findById(foreignId).isPresent();
        });

        Boolean visibleToOwner = transactionTemplate.execute(status -> {
            Session session = entityManager.unwrap(Session.class);
            session.enableFilter(TenantFilters.FILTER_NAME)
                    .setParameter(TenantFilters.PARAM_NAME, tenantB.getId());
            return subscriptionProductRepository.findById(foreignId).isPresent();
        });

        assertThat(leaked).isFalse();
        assertThat(visibleToOwner).isTrue();
    }

    @Test
    void directRepositoryCallEnablesFilterWithoutAnEnclosingServiceBean() {
        Tenant tenantA = saveTenant("direct-a-" + suffix());
        Tenant tenantB = saveTenant("direct-b-" + suffix());

        SubscriptionProduct productB = new SubscriptionProduct();
        productB.setTenant(tenantB);
        productB.setSlug("direct-cross-tenant-" + suffix());
        productB.setTitle("Other Tenant Product");
        productB.setOfferingType(OfferingType.LEVEL);
        productB.setSortOrder(1);
        productB.setActive(true);
        Long foreignId = transactionTemplate.execute(status ->
                subscriptionProductRepository.saveAndFlush(productB).getId()
        );

        // Simulate a code path that reaches the repository directly (e.g. a background job or a
        // future controller/@Component) with only TenantContext set - no enclosing @Service call,
        // and no manual session.enableFilter(...) - the real TenantHibernateFilterEnabler aspect
        // must be the thing that turns the filter on here.
        Boolean leaked = transactionTemplate.execute(status -> {
            TenantContext.setTenantId(tenantA.getId());
            return subscriptionProductRepository.findById(foreignId).isPresent();
        });

        assertThat(leaked).isFalse();
    }

    @Test
    void repositoryOwnedTransactionEnablesFilterFromTenantContext() {
        Tenant tenantA = saveTenant("repo-tx-a-" + suffix());
        Tenant tenantB = saveTenant("repo-tx-b-" + suffix());

        SubscriptionProduct productB = new SubscriptionProduct();
        productB.setTenant(tenantB);
        productB.setSlug("repo-tx-cross-tenant-" + suffix());
        productB.setTitle("Other Tenant Product");
        productB.setOfferingType(OfferingType.LEVEL);
        productB.setSortOrder(1);
        productB.setActive(true);
        Long foreignId = transactionTemplate.execute(status ->
                subscriptionProductRepository.saveAndFlush(productB).getId()
        );

        // TenantHibernateFilterEnabler fires at @Order(200), before the repository's own
        // @Transactional opens a session, so the filter must be applied while a transaction-bound
        // session is already active. Wrapping in TransactionTemplate reproduces the typical
        // production path (any outer @Transactional boundary: @Service, background job, etc.).
        Boolean leaked = transactionTemplate.execute(status -> {
            TenantContext.setTenantId(tenantA.getId());
            return subscriptionProductRepository.findById(foreignId).isPresent();
        });
    }

    /**
     * Persists an active tenant with the specified slug and name.
     *
     * @param slug the tenant's slug and name
     * @return the persisted tenant
     */
    private Tenant saveTenant(String slug) {
        return transactionTemplate.execute(status -> {
            Tenant tenant = new Tenant();
            tenant.setSlug(slug);
            tenant.setName(slug);
            tenant.setStatus(TenantStatus.ACTIVE);
            return tenantRepository.saveAndFlush(tenant);
        });
    }

    /**
     * Generates an eight-character random suffix.
     *
     * @return an eight-character string derived from a random UUID
     */
    private static String suffix() {
        return UUID.randomUUID().toString().substring(0, 8);
    }
}
