package de.pnnit.directwerk.controller.publicapi;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.modules.core.service.PublicSiteConfigService;
import de.pnnit.directwerk.modules.core.service.PublicSiteConfigService.SiteConfigView;
import de.pnnit.directwerk.modules.core.service.PublicSiteConfigService.TenantView;
import de.pnnit.directwerk.modules.core.service.StudioHome;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

class PublicSiteConfigControllerTest {

    private final PublicSiteConfigService publicSiteConfigService = mock(PublicSiteConfigService.class);
    private final HttpServletRequest request = mock(HttpServletRequest.class);
    private final PublicSiteConfigController controller = new PublicSiteConfigController(publicSiteConfigService);

    @Test
    void siteConfigPassesRequestSchemeHostAndPortToService() {
        when(request.getScheme()).thenReturn("http");
        when(request.getServerName()).thenReturn("alpha.example.test");
        when(request.getServerPort()).thenReturn(8080);
        SiteConfigView view = siteConfigView("http://alpha.example.test:8080/feeds/alpha/podcast.xml");
        when(publicSiteConfigService.loadSiteConfig("http", "alpha.example.test", 8080)).thenReturn(view);

        ResponseEntity<Response<PublicSiteConfigController.SiteConfigResponse>> response =
                controller.siteConfig(request);

        verify(publicSiteConfigService).loadSiteConfig("http", "alpha.example.test", 8080);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().data().publicRssUrl())
                .isEqualTo("http://alpha.example.test:8080/feeds/alpha/podcast.xml");
        assertThat(response.getBody().data().emailNotifyAvailable()).isFalse();
    }

    private static SiteConfigView siteConfigView(String publicRssUrl) {
        return new SiteConfigView(
                new TenantView("alpha", "Alpha Podcast"),
                List.of("DIGITAL_CONTENT", "PODCAST", "PODCAST_RSS"),
                new PublicSiteConfigService.BrandingView(null, null, null, null),
                publicRssUrl,
                null,
                StudioHome.PODCAST_DESK,
                List.of(),
                false
        );
    }
}
