package de.pnnit.directwerk.bootstrap;

import de.pnnit.directwerk.config.DirectwerkCacheNames;
import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.cache.CacheManager;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
class CacheConfigTest {

    @Autowired
    CacheManager cacheManager;

    @Test
    void registersDirectwerkCaches() {
        assertThat(cacheManager.getCache(DirectwerkCacheNames.TENANT_BY_HOST)).isNotNull();
        assertThat(cacheManager.getCache(DirectwerkCacheNames.PUBLIC_SITE_CONFIG)).isNotNull();
        assertThat(cacheManager.getCache(DirectwerkCacheNames.PUBLIC_PRODUCTS)).isNotNull();
    }
}
