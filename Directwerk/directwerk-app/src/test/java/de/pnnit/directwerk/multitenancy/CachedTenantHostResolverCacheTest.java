package de.pnnit.directwerk.multitenancy;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.config.DirectwerkCacheNames;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.entity.TenantDomain;
import de.pnnit.directwerk.modules.core.repository.TenantDomainRepository;
import de.pnnit.directwerk.modules.core.service.DirectwerkCacheEviction;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.concurrent.ConcurrentMapCacheManager;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.context.annotation.Configuration;

/**
 * Regression coverage for issue #543: the tenant-by-host lookup must be cached by the same
 * declared, normalized key on the resolve and the eviction side.
 */
class CachedTenantHostResolverCacheTest {

    private AnnotationConfigApplicationContext context;
    private TenantDomainRepository tenantDomainRepository;
    private CachedTenantHostResolver resolver;
    private DirectwerkCacheEviction cacheEviction;

    @BeforeEach
    void setUp() {
        tenantDomainRepository = mock(TenantDomainRepository.class);
        CacheManager cacheManager = new ConcurrentMapCacheManager(
                DirectwerkCacheNames.TENANT_BY_HOST,
                DirectwerkCacheNames.PUBLIC_SITE_CONFIG
        );
        context = new AnnotationConfigApplicationContext();
        context.register(CachingConfig.class);
        context.registerBean("cacheManager", CacheManager.class, () -> cacheManager);
        context.registerBean("tenantDomainRepository", TenantDomainRepository.class, () -> tenantDomainRepository);
        context.registerBean("cachedTenantHostResolver", CachedTenantHostResolver.class,
                () -> new CachedTenantHostResolver(tenantDomainRepository));
        context.registerBean("directwerkCacheEviction", DirectwerkCacheEviction.class,
                () -> new DirectwerkCacheEviction(cacheManager, tenantDomainRepository));
        context.refresh();
        resolver = context.getBean("cachedTenantHostResolver", CachedTenantHostResolver.class);
        cacheEviction = context.getBean("directwerkCacheEviction", DirectwerkCacheEviction.class);
    }

    @AfterEach
    void tearDown() {
        context.close();
    }

    @Test
    void resolveHostIsCachedDeclaratively() throws Exception {
        Cacheable cacheable = CachedTenantHostResolver.class
                .getMethod("resolveHost", String.class)
                .getAnnotation(Cacheable.class);

        assertThat(cacheable).isNotNull();
        assertThat(cacheable.cacheNames()).containsExactly(DirectwerkCacheNames.TENANT_BY_HOST);
        assertThat(cacheable.key()).contains("CacheKeys");
    }

    @Test
    void resolveCachesByNormalizedHostAndEvictionInvalidatesTheSameKey() {
        when(tenantDomainRepository.findVerifiedByHostIgnoreCaseWithTenant("example.com"))
                .thenReturn(Optional.of(domain()));

        assertThat(resolver.resolveHost("  Example.COM  ")).isPresent();
        assertThat(resolver.resolveHost("example.com")).isPresent();
        verify(tenantDomainRepository, times(1)).findVerifiedByHostIgnoreCaseWithTenant("example.com");

        cacheEviction.evictHost("EXAMPLE.com");
        assertThat(resolver.resolveHost("example.com")).isPresent();
        verify(tenantDomainRepository, times(2)).findVerifiedByHostIgnoreCaseWithTenant("example.com");
    }

    private static TenantDomain domain() {
        Tenant tenant = new Tenant();
        tenant.setId(1L);
        tenant.setSlug("alpha");
        tenant.setName("Alpha");
        TenantDomain domain = new TenantDomain();
        domain.setTenant(tenant);
        domain.setHost("example.com");
        domain.setVerified(true);
        return domain;
    }

    @Configuration
    @EnableCaching
    static class CachingConfig {
    }
}
