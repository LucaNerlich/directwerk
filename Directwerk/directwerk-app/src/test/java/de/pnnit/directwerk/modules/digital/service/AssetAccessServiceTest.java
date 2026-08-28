package de.pnnit.directwerk.modules.digital.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import de.pnnit.directwerk.modules.content.api.EntitlementApi;
import de.pnnit.directwerk.modules.digital.entity.AssetScope;
import de.pnnit.directwerk.modules.digital.entity.AssetStatus;
import de.pnnit.directwerk.modules.digital.entity.AssetType;
import de.pnnit.directwerk.modules.digital.entity.AssetVisibility;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.digital.exception.EntitlementDeniedException;
import de.pnnit.directwerk.modules.digital.exception.StorageNotConfiguredException;
import de.pnnit.directwerk.modules.digital.repository.MediaAssetRepository;
import de.pnnit.directwerk.modules.digital.storage.S3PublicUrlBuilder;
import de.pnnit.directwerk.multitenancy.TenantContext;
import de.pnnit.directwerk.multitenancy.TenantMismatchException;
import de.pnnit.directwerk.security.DirectwerkUserPrincipal;
import de.pnnit.directwerk.security.RoleConstants;
import java.net.URI;
import java.net.URL;
import java.time.Duration;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

@ExtendWith(MockitoExtension.class)
class AssetAccessServiceTest {

    @Mock
    private EntitlementApi entitlementApi;

    @Mock
    private ModuleGateService moduleGateService;

    @Mock
    private de.pnnit.directwerk.modules.digital.storage.PrivateObjectUrlSigner privateObjectUrlSigner;

    @Mock
    private DirectwerkConfig directwerkConfig;

    @Mock
    private MediaAssetRepository mediaAssetRepository;

    private AssetAccessService service;

    @BeforeEach
    void setUp() {
        service = new AssetAccessService(
                entitlementApi,
                moduleGateService,
                new S3PublicUrlBuilder("https://cdn.example.test"),
                privateObjectUrlSigner,
                directwerkConfig,
                mediaAssetRepository
        );
        TenantContext.setTenantId(10L);
    }

    @AfterEach
    void clearContext() {
        TenantContext.clear();
    }

    @Test
    void resolveDownloadUrlReturnsCdnUrlForPublicAsset() throws Exception {
        MediaAsset asset = givenLoaded(publicAsset(10L, "alpha-show-a", "alpha-show-a/public/images/test.jpg"));

        URL url = service.resolveDownloadUrl(asset, subscriber(42L, 10L));

        assertThat(url.toString()).isEqualTo("https://cdn.example.test/alpha-show-a/public/images/test.jpg");
    }

    @Test
    void resolveDownloadUrlRejectsCrossTenantAsset() {
        MediaAsset asset = givenLoaded(publicAsset(99L, "alpha-show-b", "alpha-show-b/public/images/test.jpg"));

        assertThatThrownBy(() -> service.resolveDownloadUrl(asset, subscriber(42L, 10L)))
                .isInstanceOf(TenantMismatchException.class);
    }

    @Test
    void resolveDownloadUrlDeniesPrivateContentWithoutEntitlement() {
        MediaAsset asset = givenLoaded(
                privateContentAsset(10L, "alpha-show-a", "alpha-show-a/private/audio/x.mp3", null)
        );
        when(entitlementApi.hasDigitalAssetAccess(10L, 42L, 7L)).thenReturn(false);

        assertThatThrownBy(() -> service.resolveDownloadUrl(asset, subscriber(42L, 10L)))
                .isInstanceOf(EntitlementDeniedException.class);
    }

    @Test
    void resolveDownloadUrlPresignsPrivateWhenEntitled() throws Exception {
        MediaAsset asset = givenLoaded(
                privateContentAsset(10L, "alpha-show-a", "alpha-show-a/private/audio/x.mp3", null)
        );
        when(entitlementApi.hasDigitalAssetAccess(10L, 42L, 7L)).thenReturn(true);
        URL signed = URI.create("https://s3.example/signed").toURL();
        when(privateObjectUrlSigner.signPrivateObject(eq(asset.getS3Key()), any(Duration.class))).thenReturn(signed);

        URL url = service.resolveDownloadUrl(asset, subscriber(42L, 10L));

        assertThat(url).isSameAs(signed);
        verify(privateObjectUrlSigner).signPrivateObject(eq("alpha-show-a/private/audio/x.mp3"), eq(Duration.ofHours(1)));
    }

    @Test
    void resolveDownloadUrlDelegatesPrivateDeliveryToSigner() throws Exception {
        MediaAsset asset = givenLoaded(
                privateContentAsset(10L, "alpha-show-a", "alpha-show-a/private/audio/x.mp3", null)
        );
        when(entitlementApi.hasDigitalAssetAccess(10L, 42L, 7L)).thenReturn(true);
        URL tokenUrl = URI.create("https://cdn-private.example.test/alpha-show-a/private/audio/x.mp3?token=x&expires=y").toURL();
        when(privateObjectUrlSigner.signPrivateObject(eq(asset.getS3Key()), any(Duration.class))).thenReturn(tokenUrl);
        when(directwerkConfig.storage()).thenReturn(storagePropsWithPrivateCdn());

        URL url = service.resolveDownloadUrl(asset, subscriber(42L, 10L));

        assertThat(url).isSameAs(tokenUrl);
    }

    @Test
    void resolveRssEnclosureUrlUsesRssTtlForPrivateEpisodeAsset() throws Exception {
        MediaAsset asset = givenLoaded(
                privateContentAsset(10L, "alpha-show-a", "alpha-show-a/private/audio/x.mp3", 55L)
        );
        when(entitlementApi.hasAccess(10L, 42L, 55L)).thenReturn(true);
        URL signed = URI.create("https://s3.example/rss-signed").toURL();
        when(privateObjectUrlSigner.signPrivateObject(eq(asset.getS3Key()), eq(Duration.ofHours(24)))).thenReturn(signed);

        URL url = service.resolveRssEnclosureUrl(asset, 42L);

        assertThat(url).isSameAs(signed);
    }

    @Test
    void resolvePreviewUrlAllowsEditorBypassForPrivateContent() throws Exception {
        MediaAsset asset = givenLoaded(
                privateContentAsset(10L, "alpha-show-a", "alpha-show-a/private/audio/x.mp3", 55L)
        );
        when(directwerkConfig.storage()).thenReturn(storageProps());
        when(privateObjectUrlSigner.signPrivateObject(any(String.class), any(Duration.class)))
                .thenReturn(URI.create("https://s3.example/preview").toURL());

        URL url = service.resolvePreviewUrl(asset, editor(9L, 10L), true);

        assertThat(url.toString()).isEqualTo("https://s3.example/preview");
    }

    @Test
    void resolvePreviewUrlDeniesEditorAccessToAnotherUsersPrivateAsset() {
        Tenant tenant = new Tenant();
        tenant.setId(10L);
        tenant.setSlug("alpha-show-a");

        MediaAsset asset = new MediaAsset();
        asset.setId(8L);
        asset.setTenant(tenant);
        asset.setS3Key("alpha-show-a/private/user/42/export.json");
        asset.setVisibility(AssetVisibility.PRIVATE);
        asset.setScope(AssetScope.USER);
        asset.setAssetType(AssetType.DOCUMENT);
        asset.setStatus(AssetStatus.READY);
        asset.setOwnerUserId(42L);
        givenLoaded(asset);

        assertThatThrownBy(() -> service.resolvePreviewUrl(asset, editor(9L, 10L), true))
                .isInstanceOf(EntitlementDeniedException.class);
    }

    private MediaAsset givenLoaded(MediaAsset asset) {
        lenient().when(mediaAssetRepository.findById(asset.getId())).thenReturn(Optional.of(asset));
        return asset;
    }

    private static DirectwerkProperties.Storage storageProps() {
        return storageProps(null, null);
    }

    private static DirectwerkProperties.Storage storagePropsWithPrivateCdn() {
        return storageProps("https://cdn-private.example.test", "test-token-auth-key");
    }

    private static DirectwerkProperties.Storage storageProps(String privateCdnBaseUrl, String tokenKey) {
        return new DirectwerkProperties.Storage(
                true,
                "hetzner",
                "eu-central-1",
                "directwerk-dev",
                null,
                "https://nbg1.your-objectstorage.com",
                false,
                "key",
                "secret",
                "https://cdn.example.test",
                privateCdnBaseUrl,
                tokenKey,
                Duration.ofMinutes(15),
                Duration.ofHours(1),
                Duration.ofHours(24),
                24,
                3600000L,
                null,
                null
        );
    }

    private static MediaAsset publicAsset(Long tenantId, String slug, String s3Key) {
        Tenant tenant = new Tenant();
        tenant.setId(tenantId);
        tenant.setSlug(slug);

        MediaAsset asset = new MediaAsset();
        asset.setId(1L);
        asset.setTenant(tenant);
        asset.setS3Key(s3Key);
        asset.setVisibility(AssetVisibility.PUBLIC);
        asset.setScope(AssetScope.TENANT_PUBLIC);
        asset.setAssetType(AssetType.IMAGE);
        asset.setStatus(AssetStatus.READY);
        return asset;
    }

    private static MediaAsset privateContentAsset(Long tenantId, String slug, String s3Key, Long episodeId) {
        Tenant tenant = new Tenant();
        tenant.setId(tenantId);
        tenant.setSlug(slug);

        MediaAsset asset = new MediaAsset();
        asset.setId(7L);
        asset.setTenant(tenant);
        asset.setS3Key(s3Key);
        asset.setVisibility(AssetVisibility.PRIVATE);
        asset.setScope(AssetScope.CONTENT);
        asset.setAssetType(AssetType.AUDIO);
        asset.setStatus(AssetStatus.READY);
        asset.setEpisodeId(episodeId);
        return asset;
    }

    private static DirectwerkUserPrincipal subscriber(Long userId, Long tenantId) {
        return new DirectwerkUserPrincipal(
                userId,
                "user@example.com",
                "hash",
                tenantId,
                List.of(new SimpleGrantedAuthority(RoleConstants.SUBSCRIBER))
        );
    }

    private static DirectwerkUserPrincipal editor(Long userId, Long tenantId) {
        return new DirectwerkUserPrincipal(
                userId,
                "editor@example.com",
                "hash",
                tenantId,
                List.of(new SimpleGrantedAuthority(RoleConstants.EDITOR))
        );
    }
}
