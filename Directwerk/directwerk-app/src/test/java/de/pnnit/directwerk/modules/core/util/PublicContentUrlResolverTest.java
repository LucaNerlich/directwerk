package de.pnnit.directwerk.modules.core.util;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import de.pnnit.directwerk.modules.content.ContentType;
import de.pnnit.directwerk.modules.content.PublicContentPaths;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.core.service.TenantPublicHostResolver;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class PublicContentUrlResolverTest {

    private static final Long TENANT_ID = 10L;

    @Mock
    private TenantPublicHostResolver tenantPublicHostResolver;

    @Mock
    private DirectwerkConfig directwerkConfig;

    @Mock
    private TenantRepository tenantRepository;

    private PublicContentUrlResolver resolver;

    @BeforeEach
    void setUp() {
        resolver = new PublicContentUrlResolver(tenantPublicHostResolver, directwerkConfig, tenantRepository);
    }

    @Test
    void contentPageUrlUsesVerifiedHostWithLocalePrefix() {
        when(tenantPublicHostResolver.findPrimaryVerifiedHost(TENANT_ID))
                .thenReturn(Optional.of("demo.example"));

        assertThat(resolver.contentPageUrl(TENANT_ID, ContentType.EPISODE, "folge-1"))
                .isEqualTo("https://demo.example/" + PublicContentPaths.DEFAULT_LOCALE + "/episodes/folge-1");
        assertThat(resolver.contentPageUrl(TENANT_ID, ContentType.ARTICLE, "post"))
                .isEqualTo("https://demo.example/" + PublicContentPaths.DEFAULT_LOCALE + "/articles/post");
        assertThat(resolver.notificationPreferencesUrl(TENANT_ID))
                .isEqualTo("https://demo.example/" + PublicContentPaths.DEFAULT_LOCALE + "/account");
    }

    @Test
    void loopbackVerifiedHostUsesHttpScheme() {
        when(tenantPublicHostResolver.findPrimaryVerifiedHost(TENANT_ID))
                .thenReturn(Optional.of("tenant.localhost"));

        assertThat(resolver.episodePageUrl(TENANT_ID, "ep"))
                .isEqualTo("http://tenant.localhost/" + PublicContentPaths.DEFAULT_LOCALE + "/episodes/ep");
    }

    @Test
    void fallsBackToStudioBaseWithTenantQueryWhenNoVerifiedHost() {
        when(tenantPublicHostResolver.findPrimaryVerifiedHost(TENANT_ID)).thenReturn(Optional.empty());
        when(directwerkConfig.email()).thenReturn(new DirectwerkProperties.Email(
                "smtp",
                "noreply@directwerk.local",
                "Directwerk",
                "http://localhost:3004/",
                "http://localhost:3001",
                "/accept-invite",
                "/reset-password",
                "/verify-email",
                7L
        ));
        Tenant tenant = new Tenant();
        tenant.setId(TENANT_ID);
        tenant.setSlug("alpha");
        when(tenantRepository.findById(TENANT_ID)).thenReturn(Optional.of(tenant));

        assertThat(resolver.articlePageUrl(TENANT_ID, "hello"))
                .isEqualTo("http://localhost:3004/" + PublicContentPaths.DEFAULT_LOCALE
                        + "/articles/hello?tenant=alpha");
    }
}
