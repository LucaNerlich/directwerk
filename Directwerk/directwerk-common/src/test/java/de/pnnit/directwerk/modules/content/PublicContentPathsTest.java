package de.pnnit.directwerk.modules.content;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class PublicContentPathsTest {

    @Test
    void protocolPathsStayUnprefixed() {
        assertThat(PublicContentPaths.episodePath("folge-1")).isEqualTo("/episodes/folge-1");
        assertThat(PublicContentPaths.articlePath("post")).isEqualTo("/articles/post");
    }

    @Test
    void uiPagesUseDefaultLocalePrefix() {
        assertThat(PublicContentPaths.episodePage("folge-1"))
                .isEqualTo("/" + PublicContentPaths.DEFAULT_LOCALE + "/episodes/folge-1");
        assertThat(PublicContentPaths.articlePage("post"))
                .isEqualTo("/" + PublicContentPaths.DEFAULT_LOCALE + "/articles/post");
        assertThat(PublicContentPaths.notificationPreferences())
                .isEqualTo("/" + PublicContentPaths.DEFAULT_LOCALE + "/account/notifications");
        assertThat(PublicContentPaths.newsletterConfirm())
                .isEqualTo("/" + PublicContentPaths.DEFAULT_LOCALE + "/newsletter/confirm");
        assertThat(PublicContentPaths.newsletterUnsubscribe())
                .isEqualTo("/" + PublicContentPaths.DEFAULT_LOCALE + "/newsletter/unsubscribe");
        assertThat(PublicContentPaths.newsletterSubscribe("weekly"))
                .isEqualTo("/" + PublicContentPaths.DEFAULT_LOCALE + "/newsletter/weekly");
    }

    @Test
    void localizedAcceptsExplicitLocaleAndFallsBackOnBlank() {
        assertThat(PublicContentPaths.localized("en", "/episodes/x")).isEqualTo("/en/episodes/x");
        assertThat(PublicContentPaths.localized(" ", "/articles/y"))
                .isEqualTo("/" + PublicContentPaths.DEFAULT_LOCALE + "/articles/y");
    }
}
