package de.pnnit.directwerk.modules.podcast.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.entity.User;
import de.pnnit.directwerk.modules.digital.entity.AccessPolicy;
import de.pnnit.directwerk.modules.digital.entity.AssetScope;
import de.pnnit.directwerk.modules.digital.entity.AssetStatus;
import de.pnnit.directwerk.modules.digital.entity.AssetType;
import de.pnnit.directwerk.modules.digital.entity.AssetVisibility;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.podcast.entity.Episode;
import de.pnnit.directwerk.modules.podcast.entity.PodcastSeries;
import de.pnnit.directwerk.modules.podcast.feed.SubscriberFeed;
import de.pnnit.directwerk.modules.podcast.feed.SubscriberFeedNotFoundException;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class RssFeedServiceTest {

    @Mock
    private PublicPodcastQueryService publicPodcastQueryService;

    @Mock
    private SubscriberEpisodeService subscriberEpisodeService;

    @Mock
    private EpisodeDownloadAnalyticsService episodeDownloadAnalyticsService;

    private RssFeedService rssFeedService;

    @BeforeEach
    void setUp() {
        rssFeedService = new RssFeedService(
                publicPodcastQueryService,
                subscriberEpisodeService,
                new RssXmlBuilder(),
                episodeDownloadAnalyticsService
        );
    }

    @Test
    void publicFeedChannelLinkUsesRequestOriginNotTenantSlug() {
        Tenant tenant = tenant();

        String xml = rssFeedService.buildPublicFeed(tenant, null, "http", "localhost", 8080);

        assertThat(xml).contains("<link>http://localhost:8080</link>");
        assertThat(xml).doesNotContain("<link>https://" + tenant.getSlug() + "</link>");
    }

    @Test
    void publicFeedUsesStableEnclosureProxyAndEscapesXml() {
        Tenant tenant = tenant();
        PodcastSeries series = series(tenant);
        Episode free = episode(tenant, series, 1L, "Free & <Episode>", AccessPolicy.FREE, publicAudio(10L));
        Episode paid = episode(tenant, series, 2L, "Paid Episode", AccessPolicy.PAID, privateAudio(11L));

        when(publicPodcastQueryService.listPublishedEpisodes(10L, null)).thenReturn(List.of(free, paid));
        when(episodeDownloadAnalyticsService.publicRssEnclosureUrl(
                10L,
                "http",
                "alpha.example.test",
                8080,
                "alpha",
                "episode-1"
        )).thenReturn("https://alpha.example.test/feeds/alpha/e/episode-1.mp3");

        String xml = rssFeedService.buildPublicFeed(tenant, null, "http", "alpha.example.test", 8080);

        assertThat(xml).contains("Free &amp; &lt;Episode&gt;");
        assertThat(xml).contains("&lt;p&gt;A &amp; B&lt;/p&gt;");
        assertThat(xml).contains("https://alpha.example.test/feeds/alpha/e/episode-1.mp3");
        assertThat(xml).doesNotContain("https://cdn.example.test/alpha/public/free.mp3");
        assertThat(xml).contains("urn:directwerk:episode:alpha:1");
        assertThat(xml).doesNotContain("Paid Episode");
    }

    @Test
    void publicFeedOmitsEpisodesWithDisabledEnclosure() {
        Tenant tenant = tenant();
        PodcastSeries series = series(tenant);
        Episode free = episode(tenant, series, 1L, "Free Episode", AccessPolicy.FREE, publicAudio(10L));
        free.setEnclosureEnabled(false);

        when(publicPodcastQueryService.listPublishedEpisodes(10L, null)).thenReturn(List.of(free));

        String xml = rssFeedService.buildPublicFeed(tenant, null, "http", "alpha.example.test", 8080);

        assertThat(xml).doesNotContain("Free Episode");
        assertThat(xml).doesNotContain("episode-1");
    }

    @Test
    void publicFeedOmitsReadyNonAudioAssets() {
        Tenant tenant = tenant();
        PodcastSeries series = series(tenant);
        MediaAsset image = publicAudio(10L);
        image.setAssetType(AssetType.IMAGE);
        image.setMimeType("image/jpeg");
        Episode free = episode(tenant, series, 1L, "Free Episode", AccessPolicy.FREE, image);

        when(publicPodcastQueryService.listPublishedEpisodes(10L, null)).thenReturn(List.of(free));

        String xml = rssFeedService.buildPublicFeed(tenant, null, "http", "alpha.example.test", 8080);

        assertThat(xml).doesNotContain("Free Episode");
        assertThat(xml).doesNotContain("episode-1");
        verify(episodeDownloadAnalyticsService, never()).publicRssEnclosureUrl(
                10L,
                "http",
                "alpha.example.test",
                8080,
                "alpha",
                "episode-1"
        );
    }

    @Test
    void publicFeedOmitsEpisodesWithoutPublicCdnEligibleAudio() {
        Tenant tenant = tenant();
        PodcastSeries series = series(tenant);
        Episode free = episode(tenant, series, 1L, "Free Episode", AccessPolicy.FREE, privateAudio(10L));

        when(publicPodcastQueryService.listPublishedEpisodes(10L, null)).thenReturn(List.of(free));

        String xml = rssFeedService.buildPublicFeed(tenant, null, "http", "alpha.example.test", 8080);

        assertThat(xml).doesNotContain("Free Episode");
        assertThat(xml).doesNotContain("episode-1");
        verify(episodeDownloadAnalyticsService, never()).publicRssEnclosureUrl(
                10L,
                "http",
                "alpha.example.test",
                8080,
                "alpha",
                "episode-1"
        );
    }

    @Test
    void privateFeedUsesStableTokenizedEnclosureForPaid() {
        Tenant tenant = tenant();
        PodcastSeries series = series(tenant);
        Episode paid = episode(tenant, series, 2L, "Paid Episode", AccessPolicy.PAID, privateAudio(11L));
        SubscriberFeed feed = feed(tenant);

        when(subscriberEpisodeService.listEntitledEpisodes(10L, 99L)).thenReturn(List.of(paid));
        when(episodeDownloadAnalyticsService.privateRssEnclosureUrl(
                10L,
                "http",
                "alpha.example.test",
                8080,
                "alpha",
                "tok",
                "episode-2"
        )).thenReturn("https://alpha.example.test/feeds/alpha/u/tok/e/episode-2.mp3");

        String xml = rssFeedService.buildPrivateFeed(tenant, feed, "http", "alpha.example.test", 8080);

        assertThat(xml).contains("Paid Episode");
        assertThat(xml).contains("https://alpha.example.test/feeds/alpha/u/tok/e/episode-2.mp3");
        assertThat(xml).doesNotContain("X-Amz-Signature");
    }

    @Test
    void privateFeedRejectsDisabledSubscriberFeed() {
        Tenant tenant = tenant();
        SubscriberFeed feed = feed(tenant);
        feed.setEnabled(false);

        assertThatThrownBy(() -> rssFeedService.buildPrivateFeed(tenant, feed, "http", "alpha.example.test", 8080))
                .isInstanceOf(SubscriberFeedNotFoundException.class);
        verify(subscriberEpisodeService, never()).listEntitledEpisodes(10L, 99L);
    }

    private static Tenant tenant() {
        Tenant tenant = new Tenant();
        tenant.setId(10L);
        tenant.setSlug("alpha");
        tenant.setName("Alpha & Co");
        return tenant;
    }

    private static PodcastSeries series(Tenant tenant) {
        PodcastSeries series = new PodcastSeries();
        series.setId(20L);
        series.setTenant(tenant);
        series.setSlug("main");
        series.setTitle("Main Series");
        series.setDescription("Series description");
        series.setLanguage("de");
        return series;
    }

    private static SubscriberFeed feed(Tenant tenant) {
        User user = new User();
        user.setId(99L);
        SubscriberFeed feed = new SubscriberFeed();
        feed.setId(1L);
        feed.setTenant(tenant);
        feed.setUser(user);
        feed.setFeedToken("tok");
        feed.setTitle("Private");
        feed.setEnabled(true);
        return feed;
    }

    private static Episode episode(
            Tenant tenant,
            PodcastSeries series,
            Long id,
            String title,
            AccessPolicy accessPolicy,
            MediaAsset audio
    ) {
        Episode episode = new Episode();
        episode.setId(id);
        episode.setTenant(tenant);
        episode.setSeries(series);
        episode.setSlug("episode-" + id);
        episode.setTitle(title);
        episode.setDescription("<p>A & B</p>");
        episode.setAccessPolicy(accessPolicy);
        episode.setAudioAsset(audio);
        episode.setEnclosureEnabled(true);
        episode.setPublishedAt(Instant.parse("2026-07-20T12:00:00Z"));
        return episode;
    }

    private static MediaAsset publicAudio(Long id) {
        return audio(id, AssetVisibility.PUBLIC, AssetScope.TENANT_PUBLIC, "alpha/public/free.mp3");
    }

    private static MediaAsset privateAudio(Long id) {
        return audio(id, AssetVisibility.PRIVATE, AssetScope.CONTENT, "alpha/private/paid.mp3");
    }

    private static MediaAsset audio(Long id, AssetVisibility visibility, AssetScope scope, String s3Key) {
        MediaAsset audio = new MediaAsset();
        audio.setId(id);
        audio.setTenant(tenant());
        audio.setS3Key(s3Key);
        audio.setVisibility(visibility);
        audio.setScope(scope);
        audio.setAssetType(AssetType.AUDIO);
        audio.setStatus(AssetStatus.READY);
        audio.setMimeType("audio/mpeg");
        audio.setSizeBytes(1234L);
        return audio;
    }
}
