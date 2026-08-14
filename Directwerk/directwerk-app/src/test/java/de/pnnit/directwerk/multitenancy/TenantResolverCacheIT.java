package de.pnnit.directwerk.multitenancy;

import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.entity.TenantDomain;
import de.pnnit.directwerk.modules.core.entity.TenantStatus;
import de.pnnit.directwerk.modules.core.repository.TenantDomainRepository;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

@SpringBootTest
@ActiveProfiles("test")
class TenantResolverCacheIT {

    @Autowired
    private TenantResolver tenantResolver;

    @MockitoBean
    private TenantDomainRepository tenantDomainRepository;

    @Test
    void requireActiveHostUsesCacheOnSecondLookup() {
        Tenant tenant = new Tenant();
        tenant.setId(1L);
        tenant.setStatus(TenantStatus.ACTIVE);
        TenantDomain domain = new TenantDomain();
        domain.setHost("cached.localhost");
        domain.setVerified(true);
        domain.setTenant(tenant);
        when(tenantDomainRepository.findVerifiedByHostIgnoreCaseWithTenant("cached.localhost"))
                .thenReturn(Optional.of(domain));
        clearInvocations(tenantDomainRepository);

        tenantResolver.requireActiveHost("cached.localhost");
        tenantResolver.requireActiveHost("cached.localhost");

        verify(tenantDomainRepository, times(1)).findVerifiedByHostIgnoreCaseWithTenant("cached.localhost");
    }
}
