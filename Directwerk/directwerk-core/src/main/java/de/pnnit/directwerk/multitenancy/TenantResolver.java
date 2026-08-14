package de.pnnit.directwerk.multitenancy;

import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.entity.TenantStatus;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class TenantResolver {

    private final CachedTenantHostResolver cachedTenantHostResolver;

    public Optional<Tenant> resolveHost(String host) {
        return cachedTenantHostResolver.resolveHost(host);
    }

    public Tenant requireActiveHost(String host) {
        Tenant tenant = cachedTenantHostResolver.resolveHost(host)
                .orElseThrow(() -> new TenantNotFoundException(host));
        if (tenant.getStatus() == TenantStatus.SUSPENDED) {
            throw new TenantSuspendedException(host);
        }
        return tenant;
    }
}
