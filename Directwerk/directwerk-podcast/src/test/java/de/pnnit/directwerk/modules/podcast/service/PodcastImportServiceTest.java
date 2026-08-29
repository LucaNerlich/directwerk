package de.pnnit.directwerk.modules.podcast.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.digital.api.RemoteAssetIngestApi;
import de.pnnit.directwerk.modules.digital.entity.AccessPolicy;
import de.pnnit.directwerk.modules.digital.entity.AssetType;
import de.pnnit.directwerk.modules.digital.entity.AssetVisibility;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.digital.net.RemoteContentClient;
import de.pnnit.directwerk.modules.podcast.entity.Episode;
import de.pnnit.directwerk.modules.podcast.importrss.RssFeedParser;
import de.pnnit.directwerk.modules.podcast.repository.EpisodeRepository;
import de.pnnit.directwerk.multitenancy.TenantContext;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class PodcastImportServiceTest {

    @Mock
    private RemoteContentClient remoteContentClient;
    @Mock
    private RemoteAssetIngestApi remoteAssetIngestApi;
    @Mock
    private RssFeedParser rssFeedParser;
    @Mock
    private EpisodeService episodeService;
    @Mock
    private EpisodeRepository episodeRepository;

    private PodcastImportService service;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId(10L);
        service = new PodcastImportService(
                remoteContentClient,
                remoteAssetIngestApi,
                rssFeedParser,
                episodeService,
                episodeRepository
        );
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void importIdentityIsStableWithinFeedButDifferentAcrossFeeds() {
        String first = PodcastImportService.importIdentity("https://example.com/one.xml", "episode-1");

        assertThat(first).hasSize(64);
        assertThat(PodcastImportService.importIdentity(" https://example.com/one.xml ", " episode-1 "))
                .isEqualTo(first);
        assertThat(PodcastImportService.importIdentity(
                "HTTPS://EXAMPLE.COM:443/path/../one.xml#fragment",
                "episode-1"
        )).isEqualTo(first);
        assertThat(PodcastImportService.importIdentity("https://example.com/two.xml", "episode-1"))
                .isNotEqualTo(first);
    }

    @Test
    void defaultsMissingAccessPolicyToFreeButKeepsDraftAudioPrivate() {
        String feedUrl = "https://example.com/feed.xml";
        String guid = "episode-1";
        String identity = PodcastImportService.importIdentity(feedUrl, guid);
        when(episodeRepository.findByTenantIdAndImportIdentity(10L, identity))
                .thenReturn(Optional.empty());
        when(episodeRepository.existsByTenantIdAndSlug(10L, "episode-1")).thenReturn(false);

        MediaAsset audio = new MediaAsset();
        audio.setId(11L);
        when(remoteAssetIngestApi.ingestFromUrl(any())).thenReturn(audio);
        Episode created = new Episode();
        created.setId(22L);
        when(episodeService.createImportedDraft(
                eq(10L),
                eq(7L),
                eq(1),
                eq("episode-1"),
                eq("Episode 1"),
                eq("Shownotes"),
                eq(11L),
                eq(null),
                eq(60),
                eq(AccessPolicy.FREE),
                eq(null),
                eq(Set.of()),
                eq(Set.of()),
                eq(identity)
        )).thenReturn(created);

        PodcastImportService.ImportedEpisode result = service.importEpisode(
                new PodcastImportService.ImportEpisodeCommand(
                        7L,
                        feedUrl,
                        guid,
                        "episode-1",
                        "Episode 1",
                        "Shownotes",
                        1,
                        60,
                        null,
                        null,
                        Set.of(),
                        Set.of(),
                        "https://cdn.example.com/episode-1.mp3",
                        null,
                        null
                )
        );

        assertThat(result.alreadyImported()).isFalse();
        ArgumentCaptor<RemoteAssetIngestApi.IngestCommand> ingest =
                ArgumentCaptor.forClass(RemoteAssetIngestApi.IngestCommand.class);
        verify(remoteAssetIngestApi).ingestFromUrl(ingest.capture());
        assertThat(ingest.getValue().assetType()).isEqualTo(AssetType.AUDIO);
        assertThat(ingest.getValue().intendedVisibility()).isEqualTo(AssetVisibility.PRIVATE);
    }

    @Test
    void discardsStreamedAudioWhenEpisodeCreationFails() {
        String feedUrl = "https://example.com/feed.xml";
        String guid = "episode-1";
        String identity = PodcastImportService.importIdentity(feedUrl, guid);
        when(episodeRepository.findByTenantIdAndImportIdentity(10L, identity))
                .thenReturn(Optional.empty());
        when(episodeRepository.existsByTenantIdAndSlug(10L, "episode-1")).thenReturn(false);
        MediaAsset audio = new MediaAsset();
        audio.setId(11L);
        when(remoteAssetIngestApi.ingestFromUrl(any())).thenReturn(audio);
        when(episodeService.createImportedDraft(
                any(), any(), any(), any(), any(), any(), any(), any(), any(),
                any(), any(), any(), any(), any()
        )).thenThrow(new IllegalArgumentException("invalid episode"));

        assertThatThrownBy(() -> service.importEpisode(new PodcastImportService.ImportEpisodeCommand(
                7L,
                feedUrl,
                guid,
                "episode-1",
                "Episode 1",
                "Shownotes",
                1,
                60,
                AccessPolicy.FREE,
                null,
                Set.of(),
                Set.of(),
                "https://cdn.example.com/episode-1.mp3",
                null,
                null
        ))).isInstanceOf(IllegalArgumentException.class);

        verify(remoteAssetIngestApi).discard(11L);
    }
}
