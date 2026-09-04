package de.pnnit.directwerk.modules.podcast.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.service.MembershipPermissionService;
import de.pnnit.directwerk.modules.digital.service.HtmlSanitizer;
import de.pnnit.directwerk.modules.podcast.entity.PodcastSeries;
import de.pnnit.directwerk.modules.podcast.job.RssFeedRefreshJobProducer;
import de.pnnit.directwerk.modules.podcast.repository.PodcastSeriesRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class SeriesServiceTest {

    @Mock
    private PodcastSeriesRepository podcastSeriesRepository;
    @Mock
    private TenantRepository tenantRepository;
    @Mock
    private PodcastCoverAssetResolver podcastCoverAssetResolver;
    @Mock
    private RssFeedRefreshJobProducer rssFeedRefreshScheduler;
    @Mock
    private MembershipPermissionService permissionService;

    @Test
    void createSeriesSanitizesDescription() {
        SeriesService service = new SeriesService(
                podcastSeriesRepository,
                tenantRepository,
                podcastCoverAssetResolver,
                rssFeedRefreshScheduler,
                new HtmlSanitizer(),
                permissionService
        );
        Tenant tenant = new Tenant();
        tenant.setId(10L);
        tenant.setSlug("alpha");
        when(tenantRepository.getReferenceById(10L)).thenReturn(tenant);
        when(podcastSeriesRepository.existsByTenantIdAndSlug(10L, "my-show")).thenReturn(false);
        when(podcastSeriesRepository.save(any(PodcastSeries.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        PodcastSeries saved = service.createSeries(
                10L,
                "my-show",
                "My Show",
                "<p>Hello</p><script>alert(1)</script><a href=\"https://example.com\" onclick=\"evil()\">link</a>",
                null,
                "de",
                null,
                false,
                0
        );

        assertThat(saved.getDescription()).doesNotContain("<script>", "onclick");
        assertThat(saved.getDescription()).contains("Hello");
        ArgumentCaptor<PodcastSeries> captor = ArgumentCaptor.forClass(PodcastSeries.class);
        org.mockito.Mockito.verify(podcastSeriesRepository).save(captor.capture());
        assertThat(captor.getValue().getDescription()).doesNotContain("<script>");
    }

    @Test
    void updateSeriesSanitizesDescription() {
        SeriesService service = new SeriesService(
                podcastSeriesRepository,
                tenantRepository,
                podcastCoverAssetResolver,
                rssFeedRefreshScheduler,
                new HtmlSanitizer(),
                permissionService
        );
        PodcastSeries existing = new PodcastSeries();
        Tenant tenant = new Tenant();
        tenant.setId(10L);
        tenant.setSlug("alpha");
        existing.setTenant(tenant);
        existing.setSlug("my-show");
        when(podcastSeriesRepository.findByIdAndTenantId(5L, 10L)).thenReturn(java.util.Optional.of(existing));
        when(podcastSeriesRepository.save(any(PodcastSeries.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        PodcastSeries updated = service.updateSeries(
                10L,
                5L,
                null,
                null,
                "<img src=x onerror=alert(1)>Caption",
                null,
                null,
                null,
                null,
                null,
                null
        );

        assertThat(updated.getDescription()).doesNotContain("onerror", "<img");
        assertThat(updated.getDescription()).contains("Caption");
    }
}
