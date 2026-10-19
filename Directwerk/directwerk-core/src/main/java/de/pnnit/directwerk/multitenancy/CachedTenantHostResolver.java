package de.pnnit.directwerk.multitenancy;

import de.pnnit.directwerk.config.CacheKeys;
import de.pnnit.directwerk.config.DirectwerkCacheNames;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.repository.TenantDomainRepository;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/**
 * Resolves an active routing host to a tenant. Only verified domains are eligible.
 *
 * <p>The lookup is cached declaratively like every other cache in the project, so the key is
 * normalized in exactly one place ({@link CacheKeys#host(String)}) on both the resolve and the
 * eviction side.</p>
 */
@Component
@RequiredArgsConstructor
public class CachedTenantHostResolver {

    private final TenantDomainRepository tenantDomainRepository;

    /**
     * Resolves a verified routing host to its tenant.
     *
     * @param host the host name to resolve
     * @return the matching tenant, or an empty optional when the host is blank or has no verified domain
     */
    @Cacheable(
            cacheNames = DirectwerkCacheNames.TENANT_BY_HOST,
            key = "T(de.pnnit.directwerk.config.CacheKeys).host(#host)",
            condition = "T(org.springframework.util.StringUtils).hasText(#host)"
    )
    public Optional<Tenant> resolveHost(String host) {
        if (!StringUtils.hasText(host)) {
            return Optional.empty();
        }
        String normalizedHost = CacheKeys.host(host);
        return TenantContext.callWithoutTenant(() ->
                tenantDomainRepository.findVerifiedByHostIgnoreCaseWithTenant(normalizedHost)
                        .map(domain -> domain.getTenant())
        );
    }
}
