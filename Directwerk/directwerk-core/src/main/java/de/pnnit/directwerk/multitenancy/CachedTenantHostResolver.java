package de.pnnit.directwerk.multitenancy;

import de.pnnit.directwerk.config.DirectwerkCacheNames;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.repository.TenantDomainRepository;
import java.util.Locale;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/**
 * Resolves an active routing host to a tenant. Only verified domains are eligible.
 */
@Component
@RequiredArgsConstructor
public class CachedTenantHostResolver {

    private final TenantDomainRepository tenantDomainRepository;
    private final CacheManager cacheManager;

    /**
     * Resolves a verified routing host to its tenant.
     *
     * @param host the host name to resolve
     * @return the matching tenant, or an empty optional when the host is blank or has no verified domain
     */
    public Optional<Tenant> resolveHost(String host) {
        if (!StringUtils.hasText(host)) {
            return Optional.empty();
        }
        String cacheKey = host.trim().toLowerCase(Locale.ROOT);
        Cache cache = cacheManager.getCache(DirectwerkCacheNames.TENANT_BY_HOST);
        if (cache != null) {
            Cache.ValueWrapper cached = cache.get(cacheKey);
            if (cached != null && cached.get() instanceof Optional<?> cachedTenant) {
                return cachedTenant.map(Tenant.class::cast);
            }
        }

        Optional<Tenant> resolved = TenantContext.callWithoutTenant(() ->
                tenantDomainRepository.findVerifiedByHostIgnoreCaseWithTenant(cacheKey)
                        .map(domain -> domain.getTenant())
        );
        if (cache != null) {
            cache.put(cacheKey, resolved);
        }
        return resolved;
    }
}
