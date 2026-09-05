package de.pnnit.directwerk.modules.core.service;

import static org.assertj.core.api.Assertions.assertThat;

import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.entity.TenantStatus;
import de.pnnit.directwerk.modules.core.repository.TenantDomainRepository;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest
@Testcontainers(disabledWithoutDocker = true)
@ActiveProfiles("flyway-validate")
class TenantDomainServiceConcurrencyIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:19beta2-alpine");

    @Autowired
    private TenantDomainService tenantDomainService;

    @Autowired
    private TenantRepository tenantRepository;

    @Autowired
    private TenantDomainRepository tenantDomainRepository;

    @DynamicPropertySource
    static void registerSecrets(DynamicPropertyRegistry registry) {
        registry.add("directwerk.queue.enabled", () -> "false");
        registry.add("spring.quartz.auto-startup", () -> "false");
    }

    @Test
    void concurrentPrimaryDomainInsertsLeaveAtMostOnePrimary() throws Exception {
        Tenant tenant = new Tenant();
        tenant.setSlug("concurrent-primary-" + UUID.randomUUID().toString().substring(0, 8));
        tenant.setName("Concurrent Primary");
        tenant.setStatus(TenantStatus.ACTIVE);
        Instant now = Instant.parse("2026-07-18T00:00:00Z");
        tenant.setCreatedAt(now);
        tenant.setUpdatedAt(now);
        tenant = tenantRepository.save(tenant);
        Long tenantId = tenant.getId();

        int workers = 8;
        ExecutorService executor = Executors.newFixedThreadPool(workers);
        CountDownLatch start = new CountDownLatch(1);
        AtomicInteger successes = new AtomicInteger();
        AtomicInteger failures = new AtomicInteger();
        List<Future<?>> futures = new ArrayList<>();

        for (int i = 0; i < workers; i++) {
            String host = "primary-" + i + "-" + tenantId + ".example.com";
            futures.add(executor.submit(() -> {
                start.await(5, TimeUnit.SECONDS);
                try {
                    tenantDomainService.addDomain(tenantId, host, true);
                    successes.incrementAndGet();
                } catch (IllegalStateException ex) {
                    if ("Tenant already has a primary domain".equals(ex.getMessage())) {
                        failures.incrementAndGet();
                    } else {
                        throw ex;
                    }
                }
                return null;
            }));
        }
        start.countDown();
        for (Future<?> future : futures) {
            future.get(20, TimeUnit.SECONDS);
        }
        executor.shutdownNow();

        long primaryCount = tenantDomainRepository.findByTenantId(tenantId).stream()
                .filter(domain -> domain.isPrimary())
                .count();

        assertThat(successes.get()).isGreaterThanOrEqualTo(1);
        assertThat(failures.get()).isGreaterThanOrEqualTo(0);
        assertThat(primaryCount).isEqualTo(1);
        assertThat(successes.get() + failures.get()).isEqualTo(workers);
    }
}
