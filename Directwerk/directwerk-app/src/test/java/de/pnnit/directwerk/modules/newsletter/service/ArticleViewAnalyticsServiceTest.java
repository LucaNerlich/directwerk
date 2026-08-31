package de.pnnit.directwerk.modules.newsletter.service;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import de.pnnit.directwerk.modules.core.AnalyticsModule;
import de.pnnit.directwerk.modules.core.analytics.UmamiEventClient;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.entity.TenantBranding;
import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import de.pnnit.directwerk.modules.core.service.TenantBrandingService;
import de.pnnit.directwerk.modules.digital.entity.AccessPolicy;
import de.pnnit.directwerk.modules.newsletter.entity.Article;
import de.pnnit.directwerk.modules.newsletter.entity.ArticleStatus;
import java.util.Map;
import java.util.Set;
import org.assertj.core.api.Assertions;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ArticleViewAnalyticsServiceTest {

    @Mock
    private ModuleGateService moduleGateService;

    @Mock
    private TenantBrandingService tenantBrandingService;

    @Mock
    private UmamiEventClient umamiEventClient;

    @Test
    void skipsWhenAnalyticsModuleIsNotEnabled() {
        ArticleViewAnalyticsService service = service(true);
        when(moduleGateService.enabledModuleKeys(10L)).thenReturn(Set.of());

        service.trackArticleView(10L, article(), "public-view", "alpha.example.test");

        verifyNeverTracked();
    }

    @Test
    void skipsWhenWebsiteIdIsMissing() {
        ArticleViewAnalyticsService service = service(true);
        TenantBranding branding = new TenantBranding();
        when(moduleGateService.enabledModuleKeys(10L)).thenReturn(Set.of(AnalyticsModule.KEY));
        when(tenantBrandingService.getBranding(10L)).thenReturn(branding);

        service.trackArticleView(10L, article(), "public-view", "alpha.example.test");

        verifyNeverTracked();
    }

    @Test
    void callsUmamiClientWhenConfigured() {
        ArticleViewAnalyticsService service = service(true);
        TenantBranding branding = new TenantBranding();
        branding.setUmamiWebsiteId("123e4567-e89b-12d3-a456-426614174000");
        when(moduleGateService.enabledModuleKeys(10L)).thenReturn(Set.of(AnalyticsModule.KEY));
        when(tenantBrandingService.getBranding(10L)).thenReturn(branding);

        service.trackArticleView(10L, article(), "public-view", "Alpha.Example.Test");

        ArgumentCaptor<Map<String, Object>> dataCaptor = ArgumentCaptor.forClass(Map.class);
        verify(umamiEventClient).trackEvent(
                eq("https://umami.example.test"),
                eq("123e4567-e89b-12d3-a456-426614174000"),
                eq("alpha.example.test"),
                eq("/articles/article-1"),
                eq("article-view"),
                dataCaptor.capture()
        );
        Assertions.assertThat(dataCaptor.getValue())
                .containsEntry("articleSlug", "article-1")
                .containsEntry("accessPolicy", "FREE")
                .containsEntry("source", "public-view");
    }

    @Test
    void skipsWhenSourceIsNotAllowed() {
        ArticleViewAnalyticsService service = service(true);

        service.trackArticleView(10L, article(), "private-view", "alpha.example.test");

        verifyNeverTracked();
    }

    @Test
    void usesTenantUmamiHostWhenConfigured() {
        ArticleViewAnalyticsService service = service(false);
        TenantBranding branding = new TenantBranding();
        branding.setUmamiWebsiteId("123e4567-e89b-12d3-a456-426614174000");
        branding.setUmamiHostUrl("https://tenant.umami.example.test");
        when(moduleGateService.enabledModuleKeys(10L)).thenReturn(Set.of(AnalyticsModule.KEY));
        when(tenantBrandingService.getBranding(10L)).thenReturn(branding);

        service.trackArticleView(10L, article(), "public-view", "alpha.example.test");

        verify(umamiEventClient).trackEvent(
                eq("https://tenant.umami.example.test"),
                eq("123e4567-e89b-12d3-a456-426614174000"),
                eq("alpha.example.test"),
                eq("/articles/article-1"),
                eq("article-view"),
                org.mockito.ArgumentMatchers.any()
        );
    }

    @Test
    void skipsWhenNoUmamiHostIsConfigured() {
        ArticleViewAnalyticsService service = service(false);

        service.trackArticleView(10L, article(), "public-view", "alpha.example.test");

        verifyNeverTracked();
    }

    private void verifyNeverTracked() {
        verify(umamiEventClient, never()).trackEvent(
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any()
        );
    }

    private ArticleViewAnalyticsService service(boolean analyticsEnabled) {
        return new ArticleViewAnalyticsService(
                new DirectwerkConfig(new DirectwerkProperties(
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        new DirectwerkProperties.Analytics(
                                analyticsEnabled,
                                "https://umami.example.test",
                                "Directwerk-Test/1.0"
                        ),
                        null
                )),
                moduleGateService,
                tenantBrandingService,
                umamiEventClient
        );
    }

    private static Article article() {
        Tenant tenant = new Tenant();
        tenant.setId(10L);
        tenant.setSlug("alpha");

        Article article = new Article();
        article.setId(30L);
        article.setTenant(tenant);
        article.setSlug("article-1");
        article.setTitle("Article 1");
        article.setStatus(ArticleStatus.PUBLISHED);
        article.setAccessPolicy(AccessPolicy.FREE);
        return article;
    }
}
