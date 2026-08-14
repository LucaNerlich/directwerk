package de.pnnit.directwerk.modules.core.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.entity.TenantDomain;
import de.pnnit.directwerk.modules.core.entity.TenantStatus;
import java.time.Instant;
import org.hibernate.LazyInitializationException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;
import org.springframework.test.context.ActiveProfiles;

@DataJpaTest
@ActiveProfiles("test")
class TenantDomainRepositoryTest {

    @Autowired
    private TenantDomainRepository tenantDomainRepository;

    @Autowired
    private TenantRepository tenantRepository;

    @Autowired
    private TestEntityManager entityManager;

    @Test
    void findByHostIgnoreCaseLeavesTenantLazyOutsidePersistenceContext() {
        persistDomain("alpha-a.localhost", "alpha-show-a", "Alpha Show A");
        entityManager.flush();
        entityManager.clear();

        TenantDomain domain = tenantDomainRepository.findByHostIgnoreCase("alpha-a.localhost")
                .orElseThrow();

        entityManager.clear();

        assertThatThrownBy(() -> domain.getTenant().getSlug())
                .isInstanceOf(LazyInitializationException.class);
    }

    @Test
    void findByHostIgnoreCaseWithTenantLoadsTenantOutsidePersistenceContext() {
        persistDomain("alpha-b.localhost", "alpha-show-b", "Alpha Show B");
        entityManager.flush();
        entityManager.clear();

        TenantDomain domain = tenantDomainRepository.findByHostIgnoreCaseWithTenant("alpha-b.localhost")
                .orElseThrow();

        entityManager.clear();

        assertThat(domain.getTenant().getSlug()).isEqualTo("alpha-show-b");
        assertThat(domain.getTenant().getName()).isEqualTo("Alpha Show B");
    }

    private void persistDomain(String host, String slug, String name) {
        Instant now = Instant.parse("2026-01-01T00:00:00Z");

        Tenant tenant = new Tenant();
        tenant.setSlug(slug);
        tenant.setName(name);
        tenant.setStatus(TenantStatus.ACTIVE);
        tenant.setCreatedAt(now);
        tenant.setUpdatedAt(now);
        tenantRepository.save(tenant);

        TenantDomain domain = new TenantDomain();
        domain.setTenant(tenant);
        domain.setHost(host);
        domain.setVerified(true);
        domain.setPrimary(true);
        domain.setCreatedAt(now);
        domain.setUpdatedAt(now);
        tenantDomainRepository.save(domain);
    }
}
