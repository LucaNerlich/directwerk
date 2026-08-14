package de.pnnit.directwerk.modules.digital;

import static org.assertj.core.api.Assertions.assertThat;

import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.entity.TenantModuleActivation;
import de.pnnit.directwerk.modules.core.entity.TenantStatus;
import de.pnnit.directwerk.modules.core.repository.TenantModuleActivationRepository;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.digital.DigitalContentModule;
import de.pnnit.directwerk.modules.digital.api.AssetAccessApi;
import de.pnnit.directwerk.modules.digital.api.MediaAssetQueryApi;
import de.pnnit.directwerk.modules.digital.entity.AssetScope;
import de.pnnit.directwerk.modules.digital.entity.AssetStatus;
import de.pnnit.directwerk.modules.digital.entity.AssetType;
import de.pnnit.directwerk.modules.digital.entity.AssetVisibility;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.digital.exception.EntitlementDeniedException;
import de.pnnit.directwerk.modules.digital.exception.MediaAssetNotFoundException;
import de.pnnit.directwerk.modules.digital.repository.MediaAssetRepository;
import de.pnnit.directwerk.multitenancy.TenantContext;
import de.pnnit.directwerk.multitenancy.TenantFilters;
import de.pnnit.directwerk.multitenancy.TenantMismatchException;
import de.pnnit.directwerk.security.DirectwerkUserPrincipal;
import de.pnnit.directwerk.security.RoleConstants;
import jakarta.persistence.EntityManager;
import java.util.List;
import java.util.UUID;
import org.hibernate.Session;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
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
class MediaAssetIsolationIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:19beta2-alpine");

    @Autowired
    private TenantRepository tenantRepository;

    @Autowired
    private TenantModuleActivationRepository tenantModuleActivationRepository;

    @Autowired
    private MediaAssetRepository mediaAssetRepository;

    @Autowired
    private MediaAssetQueryApi mediaAssetQueryApi;

    @Autowired
    private AssetAccessApi assetAccessApi;

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private TransactionTemplate transactionTemplate;

    @DynamicPropertySource
    static void registerSecrets(DynamicPropertyRegistry registry) {
        registry.add("directwerk.security.platform-client-secret", () -> "test-platform-" + UUID.randomUUID());
        registry.add("directwerk.security.tenant-client-secret", () -> "test-tenant-" + UUID.randomUUID());
        registry.add("directwerk.queue.enabled", () -> "false");
        registry.add("spring.quartz.auto-startup", () -> "false");
    }

    @AfterEach
    void clearContext() {
        TenantContext.clear();
    }

    @Test
    void findByIdDoesNotLeakAcrossTenantsWhenFilterEnabled() {
        Tenant tenantA = saveTenant("media-a-" + suffix());
        Tenant tenantB = saveTenant("media-b-" + suffix());

        Long foreignId = transactionTemplate.execute(status -> {
            MediaAsset asset = publicAsset(tenantB, tenantB.getSlug() + "/public/images/test.jpg");
            return mediaAssetRepository.saveAndFlush(asset).getId();
        });

        Boolean leaked = transactionTemplate.execute(status -> {
            Session session = entityManager.unwrap(Session.class);
            session.enableFilter(TenantFilters.FILTER_NAME)
                    .setParameter(TenantFilters.PARAM_NAME, tenantA.getId());
            return mediaAssetRepository.findById(foreignId).isPresent();
        });

        Boolean visibleToOwner = transactionTemplate.execute(status -> {
            Session session = entityManager.unwrap(Session.class);
            session.enableFilter(TenantFilters.FILTER_NAME)
                    .setParameter(TenantFilters.PARAM_NAME, tenantB.getId());
            return mediaAssetRepository.findById(foreignId).isPresent();
        });

        assertThat(leaked).isFalse();
        assertThat(visibleToOwner).isTrue();
    }

    @Test
    void queryApiAndAccessApiRespectTenantContext() {
        Tenant tenantA = saveTenant("access-a-" + suffix());
        Tenant tenantB = saveTenant("access-b-" + suffix());

        Long assetBId = transactionTemplate.execute(status -> {
            MediaAsset asset = publicAsset(tenantB, tenantB.getSlug() + "/public/images/cover.jpg");
            return mediaAssetRepository.saveAndFlush(asset).getId();
        });

        try {
            TenantContext.setTenantId(tenantA.getId());
            assertThat(mediaAssetQueryApi.findById(assetBId)).isEmpty();
        } finally {
            TenantContext.clear();
        }

        MediaAsset assetB = transactionTemplate.execute(status -> {
            TenantContext.setTenantId(tenantB.getId());
            return mediaAssetQueryApi.findById(assetBId).orElseThrow();
        });

        try {
            TenantContext.setTenantId(tenantA.getId());
            DirectwerkUserPrincipal principal = new DirectwerkUserPrincipal(
                    1L,
                    "editor@example.com",
                    "hash",
                    tenantA.getId(),
                    List.of(new SimpleGrantedAuthority(RoleConstants.EDITOR))
            );
            // The Hibernate tenant filter (enabled by TenantHibernateFilterEnabler on @Service
            // entry) may hide tenantB's asset before assertTenantMatch runs, producing
            // MediaAssetNotFoundException instead. Both exceptions prove cross-tenant isolation.
            org.assertj.core.api.Assertions.assertThatThrownBy(
                    () -> assetAccessApi.resolveDownloadUrl(assetB, principal)
            ).isInstanceOfAny(TenantMismatchException.class, MediaAssetNotFoundException.class);
        } finally {
            TenantContext.clear();
        }

        try {
            TenantContext.setTenantId(tenantB.getId());
            DirectwerkUserPrincipal principal = new DirectwerkUserPrincipal(
                    2L,
                    "editor-b@example.com",
                    "hash",
                    tenantB.getId(),
                    List.of(new SimpleGrantedAuthority(RoleConstants.EDITOR))
            );
            assertThat(assetAccessApi.resolveDownloadUrl(assetB, principal).toString())
                    .contains(tenantB.getSlug() + "/public/images/cover.jpg");
        } finally {
            TenantContext.clear();
        }
    }

    @Test
    void privateAssetResolveFailsClosed() {
        Tenant tenant = saveTenant("private-a-" + suffix());
        activateDigitalContent(tenant);
        Long assetId = transactionTemplate.execute(status -> {
            TenantContext.setTenantId(tenant.getId());
            MediaAsset asset = new MediaAsset();
            asset.setTenant(tenant);
            asset.setS3Key(tenant.getSlug() + "/private/audio/secret.mp3");
            asset.setVisibility(AssetVisibility.PRIVATE);
            asset.setScope(AssetScope.CONTENT);
            asset.setAssetType(AssetType.AUDIO);
            asset.setStatus(AssetStatus.READY);
            return mediaAssetRepository.saveAndFlush(asset).getId();
        });

        try {
            TenantContext.setTenantId(tenant.getId());
            MediaAsset asset = mediaAssetQueryApi.findById(assetId).orElseThrow();
            DirectwerkUserPrincipal principal = new DirectwerkUserPrincipal(
                    9L,
                    "sub@example.com",
                    "hash",
                    tenant.getId(),
                    List.of(new SimpleGrantedAuthority(RoleConstants.SUBSCRIBER))
            );
            org.assertj.core.api.Assertions.assertThatThrownBy(
                    () -> assetAccessApi.resolveDownloadUrl(asset, principal)
            ).isInstanceOf(EntitlementDeniedException.class);
        } finally {
            TenantContext.clear();
        }
    }

    private void activateDigitalContent(Tenant tenant) {
        transactionTemplate.executeWithoutResult(status -> {
            TenantContext.setTenantId(tenant.getId());
            TenantModuleActivation activation = new TenantModuleActivation();
            activation.setTenant(tenant);
            activation.setModuleKey(DigitalContentModule.KEY);
            activation.setActive(true);
            activation.setSource("TEST");
            tenantModuleActivationRepository.saveAndFlush(activation);
        });
        TenantContext.clear();
    }

    private Tenant saveTenant(String slug) {
        return transactionTemplate.execute(status -> {
            Tenant tenant = new Tenant();
            tenant.setSlug(slug);
            tenant.setName(slug);
            tenant.setStatus(TenantStatus.ACTIVE);
            return tenantRepository.saveAndFlush(tenant);
        });
    }

    private static MediaAsset publicAsset(Tenant tenant, String s3Key) {
        MediaAsset asset = new MediaAsset();
        asset.setTenant(tenant);
        asset.setS3Key(s3Key);
        asset.setVisibility(AssetVisibility.PUBLIC);
        asset.setScope(AssetScope.TENANT_PUBLIC);
        asset.setAssetType(AssetType.IMAGE);
        asset.setStatus(AssetStatus.READY);
        return asset;
    }

    private static String suffix() {
        return UUID.randomUUID().toString().substring(0, 8);
    }
}
