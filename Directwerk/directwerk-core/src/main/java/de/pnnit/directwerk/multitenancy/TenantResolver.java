package de.pnnit.directwerk.multitenancy;

import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class TenantResolver {

    private final CachedTenantHostResolver cachedTenantHostResolver;
    private final TenantRepository tenantRepository;

    public Optional<Tenant> resolveHost(String host) {
        return cachedTenantHostResolver.resolveHost(host);
    }

    /**
     * Resolves the Host-header tenant or fails. Suspended tenants are rejected —
     * "active" means {@link Tenant#isActive()}, the single definition shared by every layer.
     */
    public Tenant requireActiveHost(String host) {
        Tenant tenant = cachedTenantHostResolver.resolveHost(host)
                .orElseThrow(() -> new TenantNotFoundException(host));
        if (!tenant.isActive()) {
            throw new TenantSuspendedException(host);
        }
        return tenant;
    }

    /**
     * The {@code /feeds/{tenantSlug}/...} invariant: the path slug must identify the same
     * tenant the Host resolved to. Anything else is a 404, never a cross-tenant leak.
     */
    public Tenant requireHostTenantBySlug(String expectedSlug) {
        Long tenantId = TenantContext.getTenantId();
        if (tenantId == null) {
            throw new TenantNotFoundException(expectedSlug);
        }
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new TenantNotFoundException(expectedSlug));
        if (!tenant.getSlug().equals(expectedSlug)) {
            throw new TenantNotFoundException(expectedSlug);
        }
        return tenant;
    }
}
