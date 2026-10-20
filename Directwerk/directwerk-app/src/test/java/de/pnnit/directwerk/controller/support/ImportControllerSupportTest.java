package de.pnnit.directwerk.controller.support;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/**
 * Pins the 16-character feed-hash fragment that keeps bulk-import correlation ids stable
 * (issue #577 review): a change here silently stops queue coalescing.
 */
class ImportControllerSupportTest {

    @Test
    void feedHashKeepsTheSixteenCharacterCoalescingContract() {
        assertThat(ImportControllerSupport.feedHash("https://example.com/feed.xml"))
                .isEqualTo("7a775db75c1d6d17");
    }
}
