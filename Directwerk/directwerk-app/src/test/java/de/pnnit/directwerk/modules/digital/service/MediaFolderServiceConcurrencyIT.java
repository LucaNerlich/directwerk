package de.pnnit.directwerk.modules.digital.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.digital.api.MediaFolderApi;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.multitenancy.TenantContext;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
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
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest
@Testcontainers(disabledWithoutDocker = true)
@ActiveProfiles("flyway-validate")
class MediaFolderServiceConcurrencyIT {

    private static final int MEDIA_FOLDER_LOCK_NAMESPACE = 0x4D464C44;

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES =
            new PostgreSQLContainer<>("postgres:19beta2-alpine");

    @Autowired
    private MediaFolderApi mediaFolderApi;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private TransactionTemplate transactionTemplate;

    @DynamicPropertySource
    static void registerSecrets(DynamicPropertyRegistry registry) {
        registry.add("directwerk.security.platform-client-secret", () -> "test-platform-" + UUID.randomUUID());
        registry.add("directwerk.security.tenant-client-secret", () -> "test-tenant-" + UUID.randomUUID());
        registry.add("directwerk.queue.enabled", () -> "false");
        registry.add("spring.quartz.auto-startup", () -> "false");
    }

    @Test
    void folderCreationWaitsForConcurrentDeletionLock() throws Exception {
        TenantFixture tenant = insertTenant("folder-create-lock-");

        Long createdId = runWhileDeletionLockIsHeld(
                tenant.id(), () -> mediaFolderApi.createFolder(tenant.id(), "Created", null).getId());

        assertThat(createdId).isNotNull();
    }

    @Test
    void assetMovementWaitsForConcurrentDeletionLock() throws Exception {
        TenantFixture tenant = insertTenant("folder-move-lock-");
        long folderId = insertFolder(tenant.id(), "Target");
        long assetId = insertAsset(tenant, "move.jpg");

        Long assignedFolderId = runWhileDeletionLockIsHeld(
                tenant.id(), () -> mediaFolderApi.moveAsset(tenant.id(), assetId, folderId).getFolderId());

        assertThat(assignedFolderId).isEqualTo(folderId);
    }

    @Test
    void folderScopedUploadAssignmentWaitsForConcurrentDeletionLock() throws Exception {
        TenantFixture tenant = insertTenant("folder-upload-lock-");
        long folderId = insertFolder(tenant.id(), "Uploads");
        MediaAsset pendingUpload = new MediaAsset();
        Tenant assetTenant = new Tenant();
        assetTenant.setId(tenant.id());
        assetTenant.setSlug(tenant.slug());
        pendingUpload.setTenant(assetTenant);

        runWhileDeletionLockIsHeld(tenant.id(), () -> {
            mediaFolderApi.assignAssetToFolder(tenant.id(), pendingUpload, folderId);
            return null;
        });

        assertThat(pendingUpload.getFolderId()).isEqualTo(folderId);
    }

    private <T> T runWhileDeletionLockIsHeld(Long tenantId, Callable<T> operation) throws Exception {
        ExecutorService executor = Executors.newSingleThreadExecutor();
        AtomicReference<Future<T>> futureReference = new AtomicReference<>();
        CountDownLatch started = new CountDownLatch(1);
        try {
            transactionTemplate.executeWithoutResult(status -> {
                jdbcTemplate.query(
                        "SELECT pg_advisory_xact_lock(?, ?)",
                        resultSet -> { },
                        MEDIA_FOLDER_LOCK_NAMESPACE,
                        tenantId.intValue());
                Future<T> future = executor.submit(() -> {
                    TenantContext.setTenantId(tenantId);
                    started.countDown();
                    try {
                        return operation.call();
                    } finally {
                        TenantContext.clear();
                    }
                });
                futureReference.set(future);
                try {
                    assertThat(started.await(5, TimeUnit.SECONDS)).isTrue();
                } catch (InterruptedException ex) {
                    Thread.currentThread().interrupt();
                    throw new IllegalStateException(ex);
                }
                assertThatThrownBy(() -> future.get(300, TimeUnit.MILLISECONDS))
                        .isInstanceOf(TimeoutException.class);
            });
            return futureReference.get().get(10, TimeUnit.SECONDS);
        } finally {
            executor.shutdownNow();
        }
    }

    private TenantFixture insertTenant(String prefix) {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        String slug = prefix + suffix;
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

    private long insertFolder(long tenantId, String name) {
        return jdbcTemplate.queryForObject(
                "INSERT INTO media_folders (tenant_id, name) VALUES (?, ?) RETURNING id",
                Long.class,
                tenantId,
                name);
    }

    private long insertAsset(TenantFixture tenant, String filename) {
        return jdbcTemplate.queryForObject(
                """
                INSERT INTO media_assets (
                    tenant_id, s3_key, visibility, scope, asset_type, status
                ) VALUES (?, ?, 'PUBLIC', 'TENANT_PUBLIC', 'IMAGE', 'READY')
                RETURNING id
                """,
                Long.class,
                tenant.id(),
                tenant.slug() + "/public/images/" + filename);
    }

    private record TenantFixture(Long id, String slug) {
    }
}
