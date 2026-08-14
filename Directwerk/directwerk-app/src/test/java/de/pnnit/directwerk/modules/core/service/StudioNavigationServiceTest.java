package de.pnnit.directwerk.modules.core.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Set;
import org.junit.jupiter.api.Test;

class StudioNavigationServiceTest {

    private final StudioNavigationService service = new StudioNavigationService();

    @Test
    void writerPresetResolvesToWriteDeskOnly() {
        var view = service.resolve(Set.of("DIGITAL_CONTENT", "SUBSCRIPTION", "EMAIL_NOTIFY", "WHITELABEL"));

        assertThat(view.desks()).containsExactly(StudioDesk.WRITE);
        assertThat(view.home()).isEqualTo(StudioHome.WRITE_DESK);
    }

    @Test
    void podcastPresetResolvesToPodcastDeskHome() {
        var view = service.resolve(Set.of(
                "DIGITAL_CONTENT",
                "PODCAST",
                "PODCAST_RSS",
                "SUBSCRIPTION",
                "EMAIL_NOTIFY"
        ));

        assertThat(view.desks()).containsExactly(StudioDesk.WRITE, StudioDesk.PODCAST);
        assertThat(view.home()).isEqualTo(StudioHome.PODCAST_DESK);
    }

    @Test
    void fullPresetResolvesToOverviewHome() {
        var view = service.resolve(Set.of(
                "DIGITAL_CONTENT",
                "SUBSCRIPTION",
                "EMAIL_NOTIFY",
                "WHITELABEL",
                "PODCAST",
                "PODCAST_RSS"
        ));

        assertThat(view.desks()).containsExactly(StudioDesk.WRITE, StudioDesk.PODCAST);
        assertThat(view.home()).isEqualTo(StudioHome.OVERVIEW);
    }
}
