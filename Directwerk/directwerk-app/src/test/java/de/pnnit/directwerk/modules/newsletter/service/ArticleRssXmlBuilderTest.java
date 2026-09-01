package de.pnnit.directwerk.modules.newsletter.service;

import static org.assertj.core.api.Assertions.assertThat;

import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.digital.entity.AccessPolicy;
import de.pnnit.directwerk.modules.digital.service.HtmlSanitizer;
import de.pnnit.directwerk.modules.newsletter.entity.Article;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

class ArticleRssXmlBuilderTest {

    private final ArticleRssXmlBuilder builder = new ArticleRssXmlBuilder(new HtmlSanitizer());

    @Test
    void freeArticleIncludesFullBodyAndPubDate() {
        Tenant tenant = tenant();
        Article article = article(1L, "hello-world", "Hello World", "<p>Full body</p>", AccessPolicy.FREE);
        article.setPublishedAt(Instant.parse("2026-01-01T00:00:00Z"));

        String xml = builder.buildFeed(tenant, List.of(article), "https://alpha.example.test", null);

        assertThat(xml).contains("<title>Alpha</title>");
        assertThat(xml).contains("<link>https://alpha.example.test/articles/hello-world</link>");
        assertThat(xml).contains("<description><![CDATA[<p>Full body</p>]]></description>");
        assertThat(xml).contains("<guid isPermaLink=\"false\">urn:directwerk:article:alpha:1</guid>");
        assertThat(xml).contains("<pubDate>Thu, 1 Jan 2026 00:00:00 GMT</pubDate>");
    }

    @Test
    void paidArticleFallsBackToExcerptInsteadOfFullBody() {
        Tenant tenant = tenant();
        Article article = article(2L, "paid-post", "Paid Post", "<p>Secret body</p>", AccessPolicy.PAID);
        article.setExcerpt("Teaser only");

        String xml = builder.buildFeed(tenant, List.of(article), "https://alpha.example.test", null);

        assertThat(xml).contains("<description><![CDATA[Teaser only]]></description>");
        assertThat(xml).doesNotContain("Secret body");
    }

    @Test
    void paidArticleWithoutExcerptRendersEmptyDescription() {
        Tenant tenant = tenant();
        Article article = article(3L, "paid-no-excerpt", "Paid", "<p>Secret</p>", AccessPolicy.PAID);

        String xml = builder.buildFeed(tenant, List.of(article), "https://alpha.example.test", null);

        assertThat(xml).contains("<description><![CDATA[]]></description>");
    }

    @Test
    void descriptionIsSanitizedBeforeCdataWrapping() {
        Tenant tenant = tenant();
        Article article = article(4L, "xss-post", "Xss Post", "<p>ok</p><script>alert(1)</script>", AccessPolicy.FREE);

        String xml = builder.buildFeed(tenant, List.of(article), "https://alpha.example.test", null);

        assertThat(xml).contains("<description><![CDATA[<p>ok</p>]]></description>");
        assertThat(xml).doesNotContain("<script");
        assertThat(xml).doesNotContain("alert");
    }

    @Test
    void cdataSplitsCdataEndTokenSoXmlStaysWellFormed() {
        String encoded = ArticleRssXmlBuilder.cdata("a]]>b");

        assertThat(encoded).isEqualTo("<![CDATA[a]]]]><![CDATA[>b]]>");
    }

    @Test
    void channelTitleOverrideIsUsedWhenPresent() {
        Tenant tenant = tenant();

        String xml = builder.buildFeed(tenant, List.of(), "https://alpha.example.test", "My Custom Feed");

        assertThat(xml).contains("<title>My Custom Feed</title>");
    }

    @Test
    void blankChannelTitleOverrideFallsBackToTenantName() {
        Tenant tenant = tenant();

        String xml = builder.buildFeed(tenant, List.of(), "https://alpha.example.test", "  ");

        assertThat(xml).contains("<title>Alpha</title>");
    }

    @Test
    void escapeTextEscapesAllFiveXmlSpecialCharacters() {
        String escaped = ArticleRssXmlBuilder.escapeText("<a> & \"quote\" 'apos'");

        assertThat(escaped).isEqualTo("&lt;a&gt; &amp; &quot;quote&quot; &apos;apos&apos;");
    }

    private static Tenant tenant() {
        Tenant tenant = new Tenant();
        tenant.setId(1L);
        tenant.setSlug("alpha");
        tenant.setName("Alpha");
        return tenant;
    }

    private static Article article(long id, String slug, String title, String body, AccessPolicy accessPolicy) {
        Article article = new Article();
        article.setId(id);
        article.setSlug(slug);
        article.setTitle(title);
        article.setBody(body);
        article.setAccessPolicy(accessPolicy);
        return article;
    }
}
