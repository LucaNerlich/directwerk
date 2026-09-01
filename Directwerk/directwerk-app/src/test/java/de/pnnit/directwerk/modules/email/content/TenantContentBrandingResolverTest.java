package de.pnnit.directwerk.modules.email.content;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.entity.TenantBranding;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.core.service.TenantBrandingService;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class TenantContentBrandingResolverTest {

    private static final Long TENANT_ID = 10L;

    @Mock
    private TenantRepository tenantRepository;

    @Mock
    private TenantBrandingService tenantBrandingService;

    private TenantContentBrandingResolver resolver;

    @BeforeEach
    void setUp() {
        resolver = new TenantContentBrandingResolver(tenantRepository, tenantBrandingService);
    }

    @Test
    void usesBrandedSiteTitleAndPrimaryColorWhenSet() {
        Tenant tenant = tenant("Acme Inc");
        when(tenantRepository.findById(TENANT_ID)).thenReturn(Optional.of(tenant));
        TenantBranding branding = new TenantBranding();
        branding.setSiteTitle("Acme Magazine");
        branding.setPrimaryColor("#abcdef");
        when(tenantBrandingService.getBranding(TENANT_ID)).thenReturn(branding);

        TenantContentBrandingResolver.BrandingContext context = resolver.resolve(TENANT_ID);

        assertThat(context.tenantName()).isEqualTo("Acme Inc");
        assertThat(context.siteTitle()).isEqualTo("Acme Magazine");
        assertThat(context.primaryColor()).isEqualTo("#abcdef");
    }

    @Test
    void fallsBackToTenantNameAndDefaultColorWhenBrandingUnset() {
        Tenant tenant = tenant("Acme Inc");
        when(tenantRepository.findById(TENANT_ID)).thenReturn(Optional.of(tenant));
        when(tenantBrandingService.getBranding(TENANT_ID)).thenReturn(new TenantBranding());

        TenantContentBrandingResolver.BrandingContext context = resolver.resolve(TENANT_ID);

        assertThat(context.siteTitle()).isEqualTo("Acme Inc");
        assertThat(context.primaryColor()).isEqualTo("#2563eb");
    }

    private static Tenant tenant(String name) {
        Tenant tenant = new Tenant();
        tenant.setId(TENANT_ID);
        tenant.setName(name);
        return tenant;
    }
}
