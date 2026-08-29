package de.pnnit.directwerk.modules.podcast.service;

import static org.assertj.core.api.Assertions.assertThat;

import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.digital.entity.AssetStatus;
import de.pnnit.directwerk.modules.digital.entity.AssetType;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.podcast.entity.Episode;
import de.pnnit.directwerk.modules.podcast.entity.Format;
import de.pnnit.directwerk.modules.podcast.entity.PodcastSeries;
import org.junit.jupiter.api.Test;

class EpisodeCoverResolverTest {

    private final EpisodeCoverResolver resolver = new EpisodeCoverResolver();

    @Test
    void prefersEpisodeCoverOverFormatAndSeries() {
        Episode episode = episode();
        episode.setCoverAsset(image(1L));
        episode.getFormats().add(formatWithCover(2L, 10L));
        episode.getSeries().setCoverAsset(image(3L));

        assertThat(resolver.resolveCoverAsset(episode)).contains(episode.getCoverAsset());
    }

    @Test
    void fallsBackToFirstFormatCoverBySortOrder() {
        Episode episode = episode();
        Format later = formatWithCover(2L, 20L);
        later.setSortOrder(5);
        Format earlier = formatWithCover(3L, 30L);
        earlier.setSortOrder(1);
        episode.getFormats().add(later);
        episode.getFormats().add(earlier);

        assertThat(resolver.resolveCoverAsset(episode).map(MediaAsset::getId)).contains(30L);
    }

    @Test
    void fallsBackToSeriesCoverWhenEpisodeAndFormatsHaveNone() {
        Episode episode = episode();
        episode.getSeries().setCoverAsset(image(4L));

        assertThat(resolver.resolveCoverAsset(episode).map(MediaAsset::getId)).contains(4L);
    }

    @Test
    void returnsEmptyWhenNoCoverConfigured() {
        assertThat(resolver.resolveCoverAsset(episode())).isEmpty();
    }

    private static Episode episode() {
        Tenant tenant = new Tenant();
        tenant.setId(10L);
        tenant.setSlug("alpha");

        PodcastSeries series = new PodcastSeries();
        series.setId(20L);
        series.setTenant(tenant);
        series.setSlug("show");
        series.setTitle("Show");

        Episode episode = new Episode();
        episode.setId(1L);
        episode.setTenant(tenant);
        episode.setSeries(series);
        episode.setSlug("ep-1");
        episode.setTitle("Episode");
        return episode;
    }

    private static Format formatWithCover(Long formatId, Long coverId) {
        Format format = new Format();
        format.setId(formatId);
        format.setSlug("format-" + formatId);
        format.setName("Format " + formatId);
        format.setSortOrder(formatId.intValue());
        format.setCoverAsset(image(coverId));
        return format;
    }

    private static MediaAsset image(Long id) {
        MediaAsset asset = new MediaAsset();
        asset.setId(id);
        asset.setAssetType(AssetType.IMAGE);
        asset.setStatus(AssetStatus.READY);
        return asset;
    }
}
