package de.pnnit.directwerk.modules.podcast.access;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.digital.api.AssetAccessApi;
import de.pnnit.directwerk.modules.digital.api.EpisodeMediaApi;
import de.pnnit.directwerk.modules.digital.entity.AccessPolicy;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.podcast.entity.Episode;
import de.pnnit.directwerk.security.DirectwerkUserPrincipal;
import de.pnnit.directwerk.security.RoleConstants;
import java.net.URI;
import java.net.URL;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

@ExtendWith(MockitoExtension.class)
class SubscriberPlaybackServiceTest {

    @Mock
    private AssetAccessApi assetAccessApi;

    @Mock
    private EpisodeMediaApi episodeMediaApi;

    @Mock
    private MediaAsset audioAsset;

    @Mock
    private Episode episode;

    private SubscriberPlaybackService subscriberPlaybackService;

    @BeforeEach
    void setUp() {
        subscriberPlaybackService = new SubscriberPlaybackService(assetAccessApi, episodeMediaApi);
    }

    @Test
    void resolvePortalPlaybackUsesEpisodePortalUrlForSubscribers() throws Exception {
        when(episode.getId()).thenReturn(42L);
        DirectwerkUserPrincipal subscriber = new DirectwerkUserPrincipal(
                2L,
                "user@example.test",
                "hash",
                1L,
                List.of(new SimpleGrantedAuthority(RoleConstants.SUBSCRIBER))
        );
        when(episode.getAccessPolicy()).thenReturn(AccessPolicy.PAID);
        URL expected = URI.create("https://cdn.example.test/audio.mp3").toURL();
        when(assetAccessApi.resolveEpisodePortalUrl(audioAsset, 42L, AccessPolicy.PAID, subscriber))
                .thenReturn(expected);

        URL resolved = subscriberPlaybackService.resolvePortalPlayback(audioAsset, episode, subscriber);

        assertThat(resolved).isEqualTo(expected);
        verify(assetAccessApi).resolveEpisodePortalUrl(audioAsset, 42L, AccessPolicy.PAID, subscriber);
    }

    @Test
    void resolvePortalPlaybackUsesPreviewForPublishers() throws Exception {
        DirectwerkUserPrincipal editor = new DirectwerkUserPrincipal(
                2L,
                "editor@example.test",
                "hash",
                1L,
                List.of(new SimpleGrantedAuthority(RoleConstants.EDITOR))
        );
        URL expected = URI.create("https://cdn.example.test/preview.mp3").toURL();
        when(assetAccessApi.resolvePreviewUrl(audioAsset, editor, true)).thenReturn(expected);

        URL resolved = subscriberPlaybackService.resolvePortalPlayback(audioAsset, episode, editor);

        assertThat(resolved).isEqualTo(expected);
        verify(assetAccessApi).resolvePreviewUrl(audioAsset, editor, true);
    }

    @Test
    void resolveRssPlaybackUsesPublicCdnForFreeEpisodes() throws Exception {
        when(episode.getAccessPolicy()).thenReturn(AccessPolicy.FREE);
        URL expected = URI.create("https://cdn.example.test/free.mp3").toURL();
        when(episodeMediaApi.publicCdnUrl(audioAsset)).thenReturn(Optional.of(expected));

        URL resolved = subscriberPlaybackService.resolveRssPlayback(audioAsset, episode, 9L, "episode-slug");

        assertThat(resolved).isEqualTo(expected);
    }

    @Test
    void resolveRssPlaybackUsesRssEnclosureForPaidEpisodes() throws Exception {
        when(episode.getAccessPolicy()).thenReturn(AccessPolicy.PAID);
        URL expected = URI.create("https://signed.example.test/paid.mp3").toURL();
        when(assetAccessApi.resolveRssEnclosureUrl(audioAsset, 9L)).thenReturn(expected);

        URL resolved = subscriberPlaybackService.resolveRssPlayback(audioAsset, episode, 9L, "episode-slug");

        assertThat(resolved).isEqualTo(expected);
        verify(assetAccessApi).resolveRssEnclosureUrl(eq(audioAsset), eq(9L));
    }
}
