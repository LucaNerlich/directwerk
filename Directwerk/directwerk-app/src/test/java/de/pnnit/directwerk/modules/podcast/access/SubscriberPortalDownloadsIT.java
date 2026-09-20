package de.pnnit.directwerk.modules.podcast.access;

import static org.assertj.core.api.Assertions.assertThat;

import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.entity.TenantModuleActivation;
import de.pnnit.directwerk.modules.core.entity.TenantStatus;
import de.pnnit.directwerk.modules.core.entity.User;
import de.pnnit.directwerk.modules.core.entity.UserStatus;
import de.pnnit.directwerk.modules.core.repository.TenantModuleActivationRepository;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.core.repository.UserRepository;
import de.pnnit.directwerk.modules.digital.BonusContentModule;
import de.pnnit.directwerk.modules.digital.DigitalContentModule;
import de.pnnit.directwerk.modules.digital.entity.AccessPolicy;
import de.pnnit.directwerk.modules.digital.entity.AssetScope;
import de.pnnit.directwerk.modules.digital.entity.AssetStatus;
import de.pnnit.directwerk.modules.digital.entity.AssetType;
import de.pnnit.directwerk.modules.digital.entity.AssetVisibility;
import de.pnnit.directwerk.modules.digital.entity.DigitalPublication;
import de.pnnit.directwerk.modules.digital.entity.DigitalPublicationStatus;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.digital.repository.DigitalPublicationRepository;
import de.pnnit.directwerk.modules.digital.repository.MediaAssetRepository;
import de.pnnit.directwerk.modules.subscription.SubscriptionModule;
import de.pnnit.directwerk.modules.subscription.entity.OfferingType;
import de.pnnit.directwerk.modules.subscription.entity.Subscription;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionProduct;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionSource;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionStatus;
import de.pnnit.directwerk.modules.subscription.repository.SubscriptionProductRepository;
import de.pnnit.directwerk.modules.subscription.repository.SubscriptionRepository;
import de.pnnit.directwerk.multitenancy.TenantContext;
import de.pnnit.directwerk.security.DirectwerkUserPrincipal;
import de.pnnit.directwerk.security.RoleConstants;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
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

/**
 * End-to-end proof for the subscriber bonus desk: a published publication's FREE / LEVEL policy
 * must produce a download URL for a normal private upload, without any PACKAGE DIGITAL_ASSET
 * rule — the asset gate and the publication policy are the same evaluation.
 */
@SpringBootTest
@Testcontainers(disabledWithoutDocker = true)
@ActiveProfiles("flyway-validate")
class SubscriberPortalDownloadsIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:19beta2-alpine");

    @Autowired
    private TenantRepository tenantRepository;

    @Autowired
    private TenantModuleActivationRepository tenantModuleActivationRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private MediaAssetRepository mediaAssetRepository;

    @Autowired
    private DigitalPublicationRepository digitalPublicationRepository;

    @Autowired
    private SubscriptionProductRepository subscriptionProductRepository;

    @Autowired
    private SubscriptionRepository subscriptionRepository;

    @Autowired
    private SubscriberPortalAccessService subscriberPortalAccessService;

    @Autowired
    private TransactionTemplate transactionTemplate;

    @DynamicPropertySource
    static void registerProperties(DynamicPropertyRegistry registry) {
        registry.add("directwerk.queue.enabled", () -> "false");
        registry.add("spring.quartz.auto-startup", () -> "false");
        registry.add("directwerk.storage.private-cdn-base-url", () -> "https://cdn-private.example.test");
        registry.add("directwerk.storage.cdn-token-auth-key", () -> "test-token-auth-key");
    }

    @AfterEach
    void clearContext() {
        TenantContext.clear();
    }

    @Test
    void listDownloadsResolvesFreeAndLevelPublicationsWithoutPackageRules() {
        String suffix = suffix();
        Tenant tenant = saveTenant("downloads-" + suffix);
        activateModules(tenant);

        MediaAsset freeAsset = savePrivateDocument(tenant, "free-bonus.pdf");
        MediaAsset levelAsset = savePrivateDocument(tenant, "level-bonus.pdf");
        MediaAsset higherLevelAsset = savePrivateDocument(tenant, "higher-level-bonus.pdf");
        savePublication(tenant, freeAsset, "free-" + suffix, "Free bonus", AccessPolicy.FREE, null);
        savePublication(tenant, levelAsset, "level-" + suffix, "Level bonus", AccessPolicy.PAID, 1);
        savePublication(tenant, higherLevelAsset, "higher-" + suffix, "Higher bonus", AccessPolicy.PAID, 2);

        User entitled = saveUser("entitled-" + suffix);
        User plain = saveUser("plain-" + suffix);
        saveLevelSubscription(tenant, entitled, 1);

        try {
            TenantContext.setTenantId(tenant.getId());

            List<SubscriberPortalAccessService.AssetDownload> entitledDownloads =
                    subscriberPortalAccessService.listDownloads(subscriber(entitled, tenant));
            assertThat(entitledDownloads)
                    .extracting(SubscriberPortalAccessService.AssetDownload::asset)
                    .extracting(MediaAsset::getId)
                    .containsExactlyInAnyOrder(freeAsset.getId(), levelAsset.getId());
            assertThat(entitledDownloads)
                    .extracting(SubscriberPortalAccessService.AssetDownload::title)
                    .containsExactlyInAnyOrder("Free bonus", "Level bonus");
            assertThat(entitledDownloads).allSatisfy(download -> assertThat(download.url()).isNotNull());

            List<SubscriberPortalAccessService.AssetDownload> plainDownloads =
                    subscriberPortalAccessService.listDownloads(subscriber(plain, tenant));
            assertThat(plainDownloads)
                    .extracting(SubscriberPortalAccessService.AssetDownload::asset)
                    .extracting(MediaAsset::getId)
                    .containsExactly(freeAsset.getId());
        } finally {
            TenantContext.clear();
        }
    }

    private static DirectwerkUserPrincipal subscriber(User user, Tenant tenant) {
        return new DirectwerkUserPrincipal(
                user.getId(),
                user.getEmail(),
                "hash",
                tenant.getId(),
                List.of(new SimpleGrantedAuthority(RoleConstants.SUBSCRIBER))
        );
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

    private void activateModules(Tenant tenant) {
        transactionTemplate.executeWithoutResult(status -> {
            TenantContext.setTenantId(tenant.getId());
            for (String moduleKey : List.of(
                    DigitalContentModule.KEY,
                    BonusContentModule.KEY,
                    SubscriptionModule.MODULE_KEY
            )) {
                TenantModuleActivation activation = new TenantModuleActivation();
                activation.setTenant(tenant);
                activation.setModuleKey(moduleKey);
                activation.setActive(true);
                activation.setSource("TEST");
                tenantModuleActivationRepository.saveAndFlush(activation);
            }
        });
        TenantContext.clear();
    }

    private MediaAsset savePrivateDocument(Tenant tenant, String filename) {
        return transactionTemplate.execute(status -> {
            TenantContext.setTenantId(tenant.getId());
            MediaAsset asset = new MediaAsset();
            asset.setTenant(tenant);
            asset.setS3Key(tenant.getSlug() + "/private/bonus/" + filename);
            asset.setVisibility(AssetVisibility.PRIVATE);
            asset.setScope(AssetScope.CONTENT);
            asset.setAssetType(AssetType.DOCUMENT);
            asset.setStatus(AssetStatus.READY);
            return mediaAssetRepository.saveAndFlush(asset);
        });
    }

    private void savePublication(
            Tenant tenant,
            MediaAsset asset,
            String slug,
            String title,
            AccessPolicy accessPolicy,
            Integer requiredLevelSortOrder
    ) {
        transactionTemplate.executeWithoutResult(status -> {
            TenantContext.setTenantId(tenant.getId());
            DigitalPublication publication = new DigitalPublication();
            publication.setTenant(tenant);
            publication.setSlug(slug);
            publication.setTitle(title);
            publication.setAsset(asset);
            publication.setAccessPolicy(accessPolicy);
            publication.setRequiredLevelSortOrder(requiredLevelSortOrder);
            publication.setStatus(DigitalPublicationStatus.PUBLISHED);
            publication.setPublishedAt(Instant.now());
            digitalPublicationRepository.saveAndFlush(publication);
        });
    }

    private User saveUser(String localPart) {
        return transactionTemplate.execute(status -> {
            User user = new User();
            user.setEmail(localPart + "-" + suffix() + "@example.test");
            user.setStatus(UserStatus.ACTIVE);
            return userRepository.saveAndFlush(user);
        });
    }

    private void saveLevelSubscription(Tenant tenant, User user, int sortOrder) {
        transactionTemplate.executeWithoutResult(status -> {
            TenantContext.setTenantId(tenant.getId());
            SubscriptionProduct product = new SubscriptionProduct();
            product.setTenant(tenant);
            product.setSlug("level-" + sortOrder + "-" + suffix());
            product.setTitle("Level " + sortOrder);
            product.setOfferingType(OfferingType.LEVEL);
            product.setSortOrder(sortOrder);
            product.setActive(true);
            product = subscriptionProductRepository.saveAndFlush(product);

            Subscription subscription = new Subscription();
            subscription.setTenant(tenant);
            subscription.setUser(user);
            subscription.setProduct(product);
            subscription.setStatus(SubscriptionStatus.ACTIVE);
            subscription.setSource(SubscriptionSource.MANUAL);
            subscription.setStartedAt(Instant.now());
            subscriptionRepository.saveAndFlush(subscription);
        });
    }

    private static String suffix() {
        return UUID.randomUUID().toString().substring(0, 8);
    }
}
