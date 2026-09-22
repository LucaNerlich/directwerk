package de.pnnit.directwerk.modules.core.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.entity.TenantBranding;
import de.pnnit.directwerk.modules.core.repository.TenantBrandingRepository;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.mockito.Mockito.lenient;

@ExtendWith(MockitoExtension.class)
class TenantBrandingServiceTest {

    @Mock
    private TenantBrandingRepository tenantBrandingRepository;

    @Mock
    private TenantRepository tenantRepository;

    @Mock
    private DirectwerkCacheEviction cacheEviction;

    private TenantBrandingService service;

    @BeforeEach
    void setUp() {
        service = new TenantBrandingService(tenantBrandingRepository, tenantRepository, cacheEviction);
        Tenant tenant = new Tenant();
        tenant.setId(10L);
        TenantBranding branding = new TenantBranding();
        branding.setTenant(tenant);
        lenient().when(tenantBrandingRepository.findByTenantId(10L)).thenReturn(Optional.of(branding));
        lenient().when(tenantBrandingRepository.save(any(TenantBranding.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void acceptsHttpsLogoUrl() {
        TenantBranding saved = service.updateBranding(
                10L, null, null, null, "https://cdn.example.com/logo.png", null, null, null);

        assertThat(saved.getLogoUrl()).isEqualTo("https://cdn.example.com/logo.png");
    }

    @Test
    void rejectsJavascriptLogoUrl() {
        // Regression: logoUrl renders as <img src> on visitor-facing pages — a
        // javascript:/data: URL stored by a tenant admin would be stored XSS for
        // that tenant's visitors.
        assertThatThrownBy(() -> service.updateBranding(
                10L, null, null, null, "javascript:alert(document.domain)", null, null, null))
                .isInstanceOf(IllegalArgumentException.class);

        assertThatThrownBy(() -> service.updateBranding(
                10L, null, null, null, "data:text/html,<script>alert(1)</script>", null, null, null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsRelativeAndOversizedLogoUrl() {
        assertThatThrownBy(() -> service.updateBranding(
                10L, null, null, null, "/uploads/logo.png", null, null, null))
                .isInstanceOf(IllegalArgumentException.class);

        assertThatThrownBy(() -> service.updateBranding(
                10L, null, null, null, "https://cdn.example.com/" + "a".repeat(512), null, null, null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void blankLogoUrlClearsToNull() {
        TenantBranding saved = service.updateBranding(10L, null, null, null, "   ", null, null, null);

        assertThat(saved.getLogoUrl()).isNull();
    }

    @Test
    void nullLogoUrlLeavesExistingValueUntouched() {
        Tenant tenant = new Tenant();
        tenant.setId(11L);
        TenantBranding existing = new TenantBranding();
        existing.setTenant(tenant);
        existing.setLogoUrl("https://cdn.example.com/old.png");
        when(tenantBrandingRepository.findByTenantId(11L)).thenReturn(Optional.of(existing));

        TenantBranding saved = service.updateBranding(11L, null, null, null, null, null, null, null);

        assertThat(saved.getLogoUrl()).isEqualTo("https://cdn.example.com/old.png");
    }

    @Test
    void acceptsHttpsFaviconUrl() {
        TenantBranding saved = service.updateBranding(
                10L, null, null, null, null, "https://cdn.example.com/favicon.ico", null, null);

        assertThat(saved.getFaviconUrl()).isEqualTo("https://cdn.example.com/favicon.ico");
    }

    @Test
    void rejectsJavascriptFaviconUrl() {
        // faviconUrl renders into <link rel="icon"> — same stored-XSS rule as logoUrl.
        assertThatThrownBy(() -> service.updateBranding(
                10L, null, null, null, null, "javascript:alert(document.domain)", null, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Favicon URL");
    }

    @Test
    void blankFaviconUrlClearsToNull() {
        TenantBranding saved = service.updateBranding(10L, null, null, null, null, "   ", null, null);

        assertThat(saved.getFaviconUrl()).isNull();
    }

    @Test
    void nullFaviconUrlLeavesExistingValueUntouched() {
        Tenant tenant = new Tenant();
        tenant.setId(13L);
        TenantBranding existing = new TenantBranding();
        existing.setTenant(tenant);
        existing.setFaviconUrl("https://cdn.example.com/old.ico");
        when(tenantBrandingRepository.findByTenantId(13L)).thenReturn(Optional.of(existing));

        TenantBranding saved = service.updateBranding(13L, null, null, null, null, null, null, null);

        assertThat(saved.getFaviconUrl()).isEqualTo("https://cdn.example.com/old.ico");
    }

    @Test
    void acceptsSixDigitHexColors() {
        TenantBranding saved = service.updateBranding(
                10L, null, "#112233", "#AABBCC", null, null, null, null);

        assertThat(saved.getPrimaryColor()).isEqualTo("#112233");
        assertThat(saved.getSecondaryColor()).isEqualTo("#AABBCC");
    }

    @Test
    void trimsSurroundingWhitespaceOnHexColors() {
        TenantBranding saved = service.updateBranding(
                10L, null, "  #112233  ", null, null, null, null, null);

        assertThat(saved.getPrimaryColor()).isEqualTo("#112233");
    }

    @Test
    void rejectsHexColorsWithoutHashPrefix() {
        // type=color always emits #rrggbb; a bare "112233" is a client bug, not a
        // value to silently reinterpret.
        assertThatThrownBy(() -> service.updateBranding(
                10L, null, "112233", null, null, null, null, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Primary color");

        assertThatThrownBy(() -> service.updateBranding(
                10L, null, null, "445566", null, null, null, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Secondary color");
    }

    @Test
    void rejectsNonSixDigitAndNamedHexColors() {
        assertThatThrownBy(() -> service.updateBranding(
                10L, null, "#123", null, null, null, null, null))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.updateBranding(
                10L, null, "#11223344", null, null, null, null, null))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.updateBranding(
                10L, null, "red", null, null, null, null, null))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.updateBranding(
                10L, null, "#gggggg", null, null, null, null, null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsCssInjectionInHexColors() {
        // Regression: colors render into inline style attributes and email HTML —
        // an unvalidated value would be stored CSS/HTML injection for visitors.
        assertThatThrownBy(() -> service.updateBranding(
                10L, null, "#112233;background:url(evil)", null, null, null, null, null))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.updateBranding(
                10L, null, null, "\"><script>alert(1)</script>", null, null, null, null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void blankHexColorClearsToNull() {
        TenantBranding saved = service.updateBranding(10L, null, "   ", "  ", null, null, null, null);

        assertThat(saved.getPrimaryColor()).isNull();
        assertThat(saved.getSecondaryColor()).isNull();
    }

    @Test
    void nullHexColorLeavesExistingValueUntouched() {
        Tenant tenant = new Tenant();
        tenant.setId(12L);
        TenantBranding existing = new TenantBranding();
        existing.setTenant(tenant);
        existing.setPrimaryColor("#112233");
        existing.setSecondaryColor("#445566");
        when(tenantBrandingRepository.findByTenantId(12L)).thenReturn(Optional.of(existing));

        TenantBranding saved = service.updateBranding(12L, null, null, null, null, null, null, null);

        assertThat(saved.getPrimaryColor()).isEqualTo("#112233");
        assertThat(saved.getSecondaryColor()).isEqualTo("#445566");
    }

    @Test
    void rejectsUmamiWebsiteIdClaimedByAnotherTenant() {
        // The read path uses platform-wide Umami credentials, so a tenant must not be able to
        // adopt a website id another tenant already owns (cross-tenant stats exposure).
        when(tenantBrandingRepository.countOtherTenantsWithWebsiteId("abcdefgh", 10L)).thenReturn(1L);

        assertThatThrownBy(() -> service.updateBranding(
                10L, null, null, null, null, null, "abcdefgh", null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void acceptsUnclaimedUmamiWebsiteId() {
        when(tenantBrandingRepository.countOtherTenantsWithWebsiteId("abcdefgh", 10L)).thenReturn(0L);

        TenantBranding saved = service.updateBranding(
                10L, null, null, null, null, null, "abcdefgh", null);

        assertThat(saved.getUmamiWebsiteId()).isEqualTo("abcdefgh");
    }
}
