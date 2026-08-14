package de.pnnit.directwerk.multitenancy;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.entity.TenantStatus;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class TenantResolverTest {

    @Mock
    private CachedTenantHostResolver cachedTenantHostResolver;

    @InjectMocks
    private TenantResolver tenantResolver;

    @Test
    void resolveHostDelegatesToCachedLookup() {
        Tenant tenant = new Tenant();
        tenant.setId(1L);
        tenant.setSlug("alpha-show-a");
        tenant.setName("Alpha Show A");

        when(cachedTenantHostResolver.resolveHost("alpha-a.localhost")).thenReturn(Optional.of(tenant));

        assertThat(tenantResolver.resolveHost("alpha-a.localhost")).contains(tenant);
        verify(cachedTenantHostResolver).resolveHost("alpha-a.localhost");
    }

    @Test
    void requireActiveHostRejectsSuspendedTenant() {
        Tenant tenant = new Tenant();
        tenant.setId(1L);
        tenant.setStatus(TenantStatus.SUSPENDED);
        when(cachedTenantHostResolver.resolveHost("suspended.localhost")).thenReturn(Optional.of(tenant));

        assertThatThrownBy(() -> tenantResolver.requireActiveHost("suspended.localhost"))
                .isInstanceOf(TenantSuspendedException.class);
    }
}
