package de.pnnit.directwerk.bootstrap;

import com.github.benmanes.caffeine.cache.Caffeine;
import de.pnnit.directwerk.config.DirectwerkCacheNames;
import java.util.List;
import java.util.concurrent.TimeUnit;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCache;
import org.springframework.cache.support.SimpleCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableCaching
public class CacheConfig {

    @Bean
    CacheManager cacheManager() {
        SimpleCacheManager manager = new SimpleCacheManager();
        manager.setCaches(List.of(
                buildCache(DirectwerkCacheNames.TENANT_BY_HOST, 10_000, 10),
                buildCache(DirectwerkCacheNames.TENANT_MODULE_KEYS, 5_000, 5),
                buildCache(DirectwerkCacheNames.TENANT_MODULE_VIEWS, 5_000, 5),
                buildCache(DirectwerkCacheNames.PLATFORM_MODULES, 100, 60),
                buildCache(DirectwerkCacheNames.TENANT_BRANDING, 5_000, 10),
                buildCache(DirectwerkCacheNames.PUBLIC_PRODUCTS, 5_000, 5),
                buildCache(DirectwerkCacheNames.PUBLIC_SITE_CONFIG, 10_000, 5)
        ));
        return manager;
    }

    private static CaffeineCache buildCache(String name, int maximumSize, long expireAfterWriteMinutes) {
        return new CaffeineCache(
                name,
                Caffeine.newBuilder()
                        .maximumSize(maximumSize)
                        .expireAfterWrite(expireAfterWriteMinutes, TimeUnit.MINUTES)
                        .build()
        );
    }
}
