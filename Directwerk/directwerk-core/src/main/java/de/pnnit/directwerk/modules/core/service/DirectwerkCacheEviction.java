package de.pnnit.directwerk.modules.core.service;

import de.pnnit.directwerk.config.DirectwerkCacheNames;
import de.pnnit.directwerk.modules.core.repository.TenantDomainRepository;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.stereotype.Component;
import de.pnnit.directwerk.modules.core.transaction.TransactionAfterCommit;
import org.springframework.util.StringUtils;

@Component
@RequiredArgsConstructor
public class DirectwerkCacheEviction {

    private final CacheManager cacheManager;
    private final TenantDomainRepository tenantDomainRepository;

    public void evictHost(String host) {
        if (!StringUtils.hasText(host)) {
            return;
        }
        evict(DirectwerkCacheNames.TENANT_BY_HOST, host.trim().toLowerCase(Locale.ROOT));
        // PUBLIC_SITE_CONFIG keys are host:scheme:port — a single-key evict would miss.
        // Branding/domain changes are rare, so clear the whole cache instead of missing.
        clear(DirectwerkCacheNames.PUBLIC_SITE_CONFIG);
    }

    public void evictTenantModules(Long tenantId) {
        evict(DirectwerkCacheNames.TENANT_MODULE_KEYS, tenantId);
        evict(DirectwerkCacheNames.TENANT_MODULE_VIEWS, tenantId);
    }

    public void evictTenantBranding(Long tenantId) {
        evict(DirectwerkCacheNames.TENANT_BRANDING, tenantId);
    }

    public void evictPublicProducts(Long tenantId) {
        evict(DirectwerkCacheNames.PUBLIC_PRODUCTS, tenantId);
    }

    public void evictTenantPublicCaches(Long tenantId) {
        evictTenantModules(tenantId);
        evictTenantBranding(tenantId);
        evictPublicProducts(tenantId);
        tenantDomainRepository.findByTenantId(tenantId).forEach(domain -> {
            evictHost(domain.getHost());
        });
    }

    public void evictHostAfterCommit(String host) {
        TransactionAfterCommit.run(() -> evictHost(host));
    }

    public void evictTenantPublicCachesAfterCommit(Long tenantId) {
        TransactionAfterCommit.run(() -> evictTenantPublicCaches(tenantId));
    }

    public void evictPublicProductsAfterCommit(Long tenantId) {
        TransactionAfterCommit.run(() -> evictPublicProducts(tenantId));
    }

    private void evict(String cacheName, Object key) {
        Cache cache = cacheManager.getCache(cacheName);
        if (cache != null) {
            cache.evict(key);
        }
    }

    private void clear(String cacheName) {
        Cache cache = cacheManager.getCache(cacheName);
        if (cache != null) {
            cache.clear();
        }
    }
}
