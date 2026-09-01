package de.pnnit.directwerk.modules.newsletter.service;

import de.pnnit.directwerk.modules.content.PublicSurfacePolicy;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.digital.service.HtmlSanitizer;
import de.pnnit.directwerk.modules.newsletter.entity.Article;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Plain RSS 2.0 builder for article feeds — no iTunes namespace or enclosure, since
 * articles have no audio asset. Paid articles are included with an excerpt-only
 * description ({@link PublicSurfacePolicy#articleBody}); the full body is only served
 * on the public API/site once the reader is entitled. Descriptions are sanitized and
 * CDATA-wrapped so readers render rich text as HTML.
 */
@Component
@RequiredArgsConstructor
public class ArticleRssXmlBuilder {

    private static final DateTimeFormatter RSS_DATE_FORMATTER = DateTimeFormatter.RFC_1123_DATE_TIME;

    private final HtmlSanitizer htmlSanitizer;

    public String buildFeed(
            Tenant tenant,
            List<Article> articles,
            String originBaseUrl,
            String channelTitleOverride
    ) {
        StringBuilder xml = new StringBuilder(4096);
        xml.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        xml.append("<rss version=\"2.0\">\n");
        xml.append("  <channel>\n");
        appendElement(xml, "title", channelTitle(tenant, channelTitleOverride), 4);
        appendElement(xml, "link", originBaseUrl, 4);
        appendDescriptionElement(xml, tenant.getName(), 4);
        appendElement(xml, "language", "de", 4);
        for (Article article : articles) {
            appendArticle(xml, tenant, article, originBaseUrl);
        }
        xml.append("  </channel>\n");
        xml.append("</rss>\n");
        return xml.toString();
    }

    private void appendArticle(StringBuilder xml, Tenant tenant, Article article, String originBaseUrl) {
        String link = originBaseUrl + "/articles/" + article.getSlug();
        String description = descriptionFor(article);
        xml.append("    <item>\n");
        appendElement(xml, "title", article.getTitle(), 6);
        appendElement(xml, "link", link, 6);
        appendDescriptionElement(xml, description, 6);
        appendElement(xml, "guid", "urn:directwerk:article:" + tenant.getSlug() + ":" + article.getId(), 6,
                " isPermaLink=\"false\"");
        if (article.getPublishedAt() != null) {
            appendElement(xml, "pubDate", RSS_DATE_FORMATTER.format(article.getPublishedAt().atZone(ZoneOffset.UTC)), 6);
        }
        xml.append("    </item>\n");
    }

    private static String descriptionFor(Article article) {
        String fullBody = PublicSurfacePolicy.articleBody(article.getBody(), article.getAccessPolicy().name());
        if (fullBody != null) {
            return fullBody;
        }
        return article.getExcerpt() != null ? article.getExcerpt() : "";
    }

    private void appendDescriptionElement(StringBuilder xml, String value, int spaces) {
        xml.append(" ".repeat(spaces))
                .append("<description>")
                .append(cdata(htmlSanitizer.sanitize(value)))
                .append("</description>\n");
    }

    private static void appendElement(StringBuilder xml, String name, String value, int spaces) {
        appendElement(xml, name, value, spaces, "");
    }

    private static void appendElement(StringBuilder xml, String name, String value, int spaces, String attributes) {
        xml.append(" ".repeat(spaces))
                .append("<")
                .append(name)
                .append(attributes)
                .append(">")
                .append(escapeText(value != null ? value : ""))
                .append("</")
                .append(name)
                .append(">\n");
    }

    private static String channelTitle(Tenant tenant, String channelTitleOverride) {
        if (channelTitleOverride != null && !channelTitleOverride.isBlank()) {
            return channelTitleOverride;
        }
        return tenant.getName();
    }

    static String escapeText(String value) {
        return value
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&apos;");
    }

    /**
     * Wraps pre-sanitized content in a CDATA section so readers render rich text as HTML.
     * A literal {@code ]]>} inside the content is split across CDATA boundaries to keep
     * the document well-formed.
     */
    static String cdata(String value) {
        return "<![CDATA[" + value.replace("]]>", "]]]]><![CDATA[>") + "]]>";
    }
}
