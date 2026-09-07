package de.pnnit.directwerk.modules.digital.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import de.pnnit.directwerk.modules.digital.api.MediaAssetLifecycleApi;
import de.pnnit.directwerk.modules.digital.api.MediaFolderApi;
import de.pnnit.directwerk.modules.digital.entity.AssetStatus;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.digital.exception.MediaAssetNotFoundException;
import de.pnnit.directwerk.modules.digital.job.MediaDeleteJobProducer;
import de.pnnit.directwerk.multitenancy.TenantContext;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest
@Testcontainers(disabledWithoutDocker = true)
@ActiveProfiles("flyway-validate")
class MediaAssetRenameLifecycleConcurrencyIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES =
            new PostgreSQLContainer<>("postgres:19beta2-alpine");

    @Autowired
    private MediaFolderApi mediaFolderApi;

    @Autowired
    private MediaAssetLifecycleApi mediaAssetLifecycleApi;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private TransactionTemplate transactionTemplate;

    @MockitoBean
    private MediaDeleteJobProducer mediaDeleteJobProducer;

    @DynamicPropertySource
    static void registerProperties(DynamicPropertyRegistry registry) {
        registry.add("directwerk.storage.enabled", () -> "true");
        registry.add("directwerk.storage.access-key", () -> "test-access-key");
        registry.add("directwerk.storage.secret-key", () -> "test-secret-key");
        registry.add("directwerk.queue.enabled", () -> "false");
        registry.add("spring.quartz.auto-startup", () -> "false");
    }

    @Test
    void lifecycleTransitionWinsConcurrentRename() throws Exception {
        TenantFixture tenant = insertTenant();
        long assetId = insertAsset(tenant);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        AtomicReference<Future<MediaAsset>> deleteReference = new AtomicReference<>();
        AtomicReference<Future<MediaAsset>> renameReference = new AtomicReference<>();
        CountDownLatch deleteStarted = new CountDownLatch(1);
        CountDownLatch renameStarted = new CountDownLatch(1);

        try {
            transactionTemplate.executeWithoutResult(status -> {
                jdbcTemplate.queryForObject(
                        "SELECT id FROM media_assets WHERE id = ? FOR UPDATE",
                        Long.class,
                        assetId);

                Future<MediaAsset> deleteFuture = executor.submit(() -> withTenant(tenant.id(), () -> {
                    deleteStarted.countDown();
                    return mediaAssetLifecycleApi.delete(
                            new MediaAssetLifecycleApi.DeleteCommand(assetId, null, true));
                }));
                deleteReference.set(deleteFuture);
                awaitStarted(deleteStarted);
                assertStillBlocked(deleteFuture);

                Future<MediaAsset> renameFuture = executor.submit(() -> withTenant(tenant.id(), () -> {
                    renameStarted.countDown();
                    return mediaFolderApi.renameAsset(tenant.id(), assetId, "renamed.mp3");
                }));
                renameReference.set(renameFuture);
                awaitStarted(renameStarted);
                assertStillBlocked(renameFuture);
            });

            assertThat(deleteReference.get().get(10, TimeUnit.SECONDS).getStatus())
                    .isEqualTo(AssetStatus.PENDING_DELETE);
            assertThatThrownBy(() -> renameReference.get().get(10, TimeUnit.SECONDS))
                    .isInstanceOf(ExecutionException.class)
                    .hasCauseInstanceOf(MediaAssetNotFoundException.class);
            assertThat(jdbcTemplate.queryForObject(
                    "SELECT status FROM media_assets WHERE id = ?", String.class, assetId))
                    .isEqualTo("PENDING_DELETE");
        } finally {
            executor.shutdownNow();
        }
    }

    private static <T> T withTenant(Long tenantId, ThrowingSupplier<T> operation) throws Exception {
        TenantContext.setTenantId(tenantId);
        try {
            return operation.get();
        } finally {
            TenantContext.clear();
        }
    }

    private static void awaitStarted(CountDownLatch started) {
        try {
            assertThat(started.await(5, TimeUnit.SECONDS)).isTrue();
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(ex);
        }
    }

    private static void assertStillBlocked(Future<?> future) {
        assertThatThrownBy(() -> future.get(300, TimeUnit.MILLISECONDS))
                .isInstanceOf(TimeoutException.class);
    }

    private TenantFixture insertTenant() {
        String slug = "rename-lifecycle-" + UUID.randomUUID().toString().substring(0, 8);
        long tenantId = jdbcTemplate.queryForObject(
                "INSERT INTO tenants (slug, name, status) VALUES (?, ?, 'ACTIVE') RETURNING id",
                Long.class,
                slug,
                slug);
        jdbcTemplate.update(
                """
                INSERT INTO tenant_module_activations (tenant_id, module_key, active, source)
                VALUES (?, 'DIGITAL_CONTENT', TRUE, 'MANUAL')
                """,
                tenantId);
        return new TenantFixture(tenantId, slug);
    }

    private long insertAsset(TenantFixture tenant) {
        return jdbcTemplate.queryForObject(
                """
                INSERT INTO media_assets (
                    tenant_id, s3_key, visibility, scope, asset_type, status, original_filename
                ) VALUES (?, ?, 'PUBLIC', 'TENANT_PUBLIC', 'AUDIO', 'READY', 'original.mp3')
                RETURNING id
                """,
                Long.class,
                tenant.id(),
                tenant.slug() + "/public/audio/original.mp3");
    }

    @FunctionalInterface
    private interface ThrowingSupplier<T> {
        T get() throws Exception;
    }

    private record TenantFixture(Long id, String slug) {
    }
}
