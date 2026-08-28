package de.pnnit.directwerk.modules.podcast.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.entity.TenantDomain;
import de.pnnit.directwerk.modules.core.entity.User;
import de.pnnit.directwerk.modules.core.repository.TenantDomainRepository;
import de.pnnit.directwerk.modules.digital.api.AssetAccessApi;
import de.pnnit.directwerk.modules.podcast.access.SubscriberFeedAccess;
import de.pnnit.directwerk.modules.digital.api.EpisodeMediaApi;
import de.pnnit.directwerk.modules.digital.entity.AccessPolicy;
import de.pnnit.directwerk.modules.digital.entity.AssetScope;
import de.pnnit.directwerk.modules.digital.entity.AssetStatus;
import de.pnnit.directwerk.modules.digital.entity.AssetType;
import de.pnnit.directwerk.modules.digital.entity.AssetVisibility;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.podcast.entity.Episode;
import de.pnnit.directwerk.modules.podcast.entity.EpisodeStatus;
import de.pnnit.directwerk.modules.podcast.entity.Format;
import de.pnnit.directwerk.modules.podcast.entity.PodcastSeries;
import de.pnnit.directwerk.modules.podcast.entity.SeriesStatus;
import de.pnnit.directwerk.modules.podcast.exception.EpisodeNotFoundException;
import de.pnnit.directwerk.modules.podcast.feed.SubscriberFeed;
import de.pnnit.directwerk.modules.podcast.feed.SubscriberFeedNotFoundException;
import de.pnnit.directwerk.modules.podcast.repository.EpisodeRepository;
import java.net.URI;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class EpisodeEnclosureServiceTest {

    @Mock
    private EpisodeRepository episodeRepository;

    @Mock
    private EpisodeMediaApi episodeMediaApi;

    @Mock
    private AssetAccessApi assetAccessApi;

    @Mock
    private SubscriberFeedAccess subscriberFeedAccess;

    @Mock
    private TenantDomainRepository tenantDomainRepository;

    @InjectMocks
    private EpisodeEnclosureService service;

    @Test
    void publicRedirectUsesCdn() throws Exception {
        Episode episode = freeEpisode();
        when(episodeRepository.findByTenantIdAndSlugAndStatusAndSeriesStatus(
                10L, "episode-1", EpisodeStatus.PUBLISHED, SeriesStatus.PUBLISHED
        )).thenReturn(Optional.of(episode));
        when(episodeMediaApi.publicCdnUrl(episode.getAudioAsset()))
                .thenReturn(Optional.of(URI.create("https://cdn.example.test/free.mp3").toURL()));

        var redirect = service.resolvePublicRedirect(10L, "episode-1");

        assertThat(redirect.targetUrl()).hasToString("https://cdn.example.test/free.mp3");
        assertThat(redirect.episode()).isSameAs(episode);
    }

    @Test
    void publicRedirectFailsWhenEnclosureDisabled() {
        Episode episode = freeEpisode();
        episode.setEnclosureEnabled(false);
        when(episodeRepository.findByTenantIdAndSlugAndStatusAndSeriesStatus(
                10L, "episode-1", EpisodeStatus.PUBLISHED, SeriesStatus.PUBLISHED
        )).thenReturn(Optional.of(episode));

        assertThatThrownBy(() -> service.resolvePublicRedirect(10L, "episode-1"))
                .isInstanceOf(EpisodeNotFoundException.class);
    }

    @Test
    void privateRedirectFailsWhenFeedDisabled() {
        SubscriberFeed feed = feed();
        feed.setEnabled(false);

        assertThatThrownBy(() -> service.resolvePrivateRedirect(feed, "episode-1"))
                .isInstanceOf(SubscriberFeedNotFoundException.class);
    }

    @Test
    void privatePaidRedirectPresignsWhenEntitled() throws Exception {
        Episode episode = paidEpisode();
        SubscriberFeed feed = feed();
        when(episodeRepository.findByTenantIdAndSlugAndStatusAndSeriesStatus(
                10L, "episode-2", EpisodeStatus.PUBLISHED, SeriesStatus.PUBLISHED
        )).thenReturn(Optional.of(episode));
        when(subscriberFeedAccess.hasEpisodeAccess(10L, 99L, feed, episode)).thenReturn(true);
        when(assetAccessApi.resolveRssEnclosureUrl(episode.getAudioAsset(), 99L))
                .thenReturn(URI.create("https://s3.example.test/signed?X-Amz-Expires=86400").toURL());

        var redirect = service.resolvePrivateRedirect(feed, "episode-2");

        assertThat(redirect.targetUrl().toString()).contains("X-Amz-Expires");
    }

    @Test
    void privatePaidRedirectFailsWithoutEntitlement() {
        Episode episode = paidEpisode();
        SubscriberFeed feed = feed();
        when(episodeRepository.findByTenantIdAndSlugAndStatusAndSeriesStatus(
                10L, "episode-2", EpisodeStatus.PUBLISHED, SeriesStatus.PUBLISHED
        )).thenReturn(Optional.of(episode));
        when(subscriberFeedAccess.hasEpisodeAccess(10L, 99L, feed, episode)).thenReturn(false);

        assertThatThrownBy(() -> service.resolvePrivateRedirect(feed, "episode-2"))
                .isInstanceOf(EpisodeNotFoundException.class);
    }

    @Test
    void privatePaidRedirectFailsWhenCustomFeedDoesNotSelectEpisodeFormat() {
        Episode episode = paidEpisode();
        Format interview = new Format();
        interview.setId(3L);
        interview.setActive(true);
        episode.getFormats().add(interview);
        SubscriberFeed feed = feed();
        feed.setDefaultFeed(false);
        Format bonus = new Format();
        bonus.setId(8L);
        bonus.setActive(true);
        feed.getFormats().add(bonus);
        when(episodeRepository.findByTenantIdAndSlugAndStatusAndSeriesStatus(
                10L, "episode-2", EpisodeStatus.PUBLISHED, SeriesStatus.PUBLISHED
        )).thenReturn(Optional.of(episode));
        when(subscriberFeedAccess.hasEpisodeAccess(10L, 99L, feed, episode)).thenReturn(false);

        assertThatThrownBy(() -> service.resolvePrivateRedirect(feed, "episode-2"))
                .isInstanceOf(EpisodeNotFoundException.class);
    }

    @Test
    void publicEnclosureUrlUsesAllowListedVerifiedHost() {
        TenantDomain domain = verifiedDomain("alpha.example.test", true);
        when(tenantDomainRepository.findByTenantIdAndHostIgnoreCase(10L, "alpha.example.test"))
                .thenReturn(Optional.of(domain));

        String url = service.publicEnclosureUrl(10L, "https", "Alpha.Example.Test", 443, "alpha", "episode-1");

        assertThat(url).isEqualTo("https://alpha.example.test/feeds/alpha/e/episode-1.mp3");
    }

    @Test
    void publicEnclosureUrlFallsBackToPrimaryVerifiedHostWhenRequestedHostUntrusted() {
        when(tenantDomainRepository.findByTenantIdAndHostIgnoreCase(10L, "evil.example.test"))
                .thenReturn(Optional.empty());
        when(tenantDomainRepository.findByTenantId(10L)).thenReturn(java.util.List.of(
                verifiedDomain("secondary.example.test", false),
                verifiedDomain("primary.example.test", true)
        ));

        String url = service.publicEnclosureUrl(10L, "https", "evil.example.test", 443, "alpha", "episode-1");

        assertThat(url).isEqualTo("https://primary.example.test/feeds/alpha/e/episode-1.mp3");
    }

    @Test
    void publicEnclosureUrlKeepsNonDefaultPortFromRequest() {
        TenantDomain domain = verifiedDomain("alpha.example.test", true);
        when(tenantDomainRepository.findByTenantIdAndHostIgnoreCase(10L, "alpha.example.test"))
                .thenReturn(Optional.of(domain));

        String url = service.publicEnclosureUrl(10L, "http", "alpha.example.test", 8080, "alpha", "episode-1");

        assertThat(url).isEqualTo("http://alpha.example.test:8080/feeds/alpha/e/episode-1.mp3");
    }

    @Test
    void privateEnclosureUrlKeepsNonDefaultPortFromRequest() {
        TenantDomain domain = verifiedDomain("alpha.example.test", true);
        when(tenantDomainRepository.findByTenantIdAndHostIgnoreCase(10L, "alpha.example.test"))
                .thenReturn(Optional.of(domain));

        String url = service.privateEnclosureUrl(10L, "http", "alpha.example.test", 8080, "alpha", "tok", "episode-1");

        assertThat(url).isEqualTo("http://alpha.example.test:8080/feeds/alpha/u/tok/e/episode-1.mp3");
    }

    private static TenantDomain verifiedDomain(String host, boolean primary) {
        TenantDomain domain = new TenantDomain();
        domain.setId(primary ? 1L : 2L);
        domain.setHost(host);
        domain.setVerified(true);
        domain.setPrimary(primary);
        return domain;
    }

    private static SubscriberFeed feed() {
        Tenant tenant = tenant();
        User user = new User();
        user.setId(99L);
        SubscriberFeed feed = new SubscriberFeed();
        feed.setTenant(tenant);
        feed.setUser(user);
        feed.setFeedToken("tok");
        feed.setEnabled(true);
        return feed;
    }

    private static Episode freeEpisode() {
        Episode episode = baseEpisode(40L, "episode-1", AccessPolicy.FREE);
        MediaAsset audio = audio(30L, AssetVisibility.PUBLIC, AssetScope.TENANT_PUBLIC, "alpha/public/ep.mp3");
        episode.setAudioAsset(audio);
        return episode;
    }

    private static Episode paidEpisode() {
        Episode episode = baseEpisode(50L, "episode-2", AccessPolicy.PAID);
        MediaAsset audio = audio(31L, AssetVisibility.PRIVATE, AssetScope.CONTENT, "alpha/private/ep.mp3");
        audio.setEpisodeId(50L);
        episode.setAudioAsset(audio);
        return episode;
    }

    private static Episode baseEpisode(Long id, String slug, AccessPolicy policy) {
        Tenant tenant = tenant();
        PodcastSeries series = new PodcastSeries();
        series.setId(20L);
        series.setTenant(tenant);
        series.setSlug("main");
        Episode episode = new Episode();
        episode.setId(id);
        episode.setTenant(tenant);
        episode.setSeries(series);
        episode.setSlug(slug);
        episode.setTitle("Episode");
        episode.setAccessPolicy(policy);
        episode.setStatus(EpisodeStatus.PUBLISHED);
        episode.setEnclosureEnabled(true);
        return episode;
    }

    private static MediaAsset audio(Long id, AssetVisibility visibility, AssetScope scope, String key) {
        MediaAsset audio = new MediaAsset();
        audio.setId(id);
        audio.setTenant(tenant());
        audio.setS3Key(key);
        audio.setVisibility(visibility);
        audio.setScope(scope);
        audio.setAssetType(AssetType.AUDIO);
        audio.setStatus(AssetStatus.READY);
        return audio;
    }

    private static Tenant tenant() {
        Tenant tenant = new Tenant();
        tenant.setId(10L);
        tenant.setSlug("alpha");
        return tenant;
    }
}
