package de.pnnit.directwerk.modules.core.repository;

import static org.assertj.core.api.Assertions.assertThat;

import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.entity.TenantDomain;
import de.pnnit.directwerk.modules.core.entity.TenantStatus;
import java.time.Instant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.ActiveProfiles;

/**
 * Issue #551: the console search must span the whole estate, not just the loaded page.
 */
@DataJpaTest
@ActiveProfiles("test")
class TenantRepositorySearchTest {

    @Autowired
    private TenantRepository tenantRepository;

    @Autowired
    private TestEntityManager entityManager;

    @BeforeEach
    void seed() {
        Tenant alpha = persistTenant("Alpha Show", "alpha-show");
        persistDomain(alpha, "alpha.example.test");
        Tenant beta = persistTenant("Beta Studio", "beta-studio");
        persistDomain(beta, "beta.example.test");
        entityManager.flush();
        entityManager.clear();
    }

    @Test
    void findsTenantsOnLaterPagesByName() {
        assertThat(tenantRepository.search("beta", PageRequest.of(0, 10)))
                .extracting(Tenant::getSlug)
                .containsExactly("beta-studio");
    }

    @Test
    void searchIsCaseInsensitive() {
        assertThat(tenantRepository.search("ALPHA SHOW", PageRequest.of(0, 10)))
                .extracting(Tenant::getSlug)
                .containsExactly("alpha-show");
    }

    @Test
    void findsTenantsByCustomDomain() {
        assertThat(tenantRepository.search("beta.example", PageRequest.of(0, 10)))
                .extracting(Tenant::getSlug)
                .containsExactly("beta-studio");
    }

    private Tenant persistTenant(String name, String slug) {
        Instant now = Instant.parse("2026-01-01T00:00:00Z");
        Tenant tenant = new Tenant();
        tenant.setSlug(slug);
        tenant.setName(name);
        tenant.setStatus(TenantStatus.ACTIVE);
        tenant.setCreatedAt(now);
        tenant.setUpdatedAt(now);
        return entityManager.persist(tenant);
    }

    private void persistDomain(Tenant tenant, String host) {
        Instant now = Instant.parse("2026-01-01T00:00:00Z");
        TenantDomain domain = new TenantDomain();
        domain.setTenant(tenant);
        domain.setHost(host);
        domain.setVerified(true);
        domain.setPrimary(true);
        domain.setCreatedAt(now);
        domain.setUpdatedAt(now);
        entityManager.persist(domain);
    }
}
