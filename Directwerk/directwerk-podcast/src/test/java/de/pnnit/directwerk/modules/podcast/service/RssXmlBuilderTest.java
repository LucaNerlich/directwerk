package de.pnnit.directwerk.modules.podcast.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class RssXmlBuilderTest {

    @Test
    void escapeTextStripsXmlInvalidControlCharacters() {
        // Issue #320: U+0000-U+0008/U+000B/U+000C/U+000E-U+001F are not legal in XML text, so a
        // single control character in a title makes every subscriber's podcatcher fail.
        assertThat(RssXmlBuilder.escapeText("AB\u0001C\u000BD\u000CE\u001FF")).isEqualTo("ABCDEF");
    }

    @Test
    void escapeTextStillEscapesXmlMetacharacters() {
        assertThat(RssXmlBuilder.escapeText("a & <b> \"c\" 'd'"))
                .isEqualTo("a &amp; &lt;b&gt; &quot;c&quot; &apos;d&apos;");
    }

    @Test
    void escapeTextKeepsLegalWhitespace() {
        assertThat(RssXmlBuilder.escapeText("line1\nline2\ttabbed"))
                .isEqualTo("line1\nline2\ttabbed");
    }
}
