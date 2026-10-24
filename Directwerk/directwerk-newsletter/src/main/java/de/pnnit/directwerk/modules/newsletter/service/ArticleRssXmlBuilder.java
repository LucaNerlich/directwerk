package de.pnnit.directwerk.modules.newsletter.service;

import de.pnnit.directwerk.modules.content.PublicSurfacePolicy;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.digital.importing.RssXmlWriter;
import de.pnnit.directwerk.modules.digital.service.HtmlSanitizer;
import de.pnnit.directwerk.modules.newsletter.entity.Article;
import java.util.List;
import java.util.function.Function;
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

    private final HtmlSanitizer htmlSanitizer;

    public String buildFeed(
            Tenant tenant,
            List<Article> articles,
            String originBaseUrl,
            String channelTitleOverride
    ) {
        return buildFeed(tenant, articles, originBaseUrl, channelTitleOverride, null);
    }

    public String buildFeed(
            Tenant tenant,
            List<Article> articles,
            String originBaseUrl,
            String channelTitleOverride,
            Function<Article, String> linkProvider
    ) {
        RssXmlWriter.Channel channel = new RssXmlWriter.Channel(
                channelTitle(tenant, channelTitleOverride),
                originBaseUrl,
                tenant.getName(),
                "de",
                false,
                null,
                false,
                null,
                null
        );
        return RssXmlWriter.build(
                channel,
                articles,
                article -> toItem(tenant, originBaseUrl, article, linkProvider),
                htmlSanitizer::sanitize
        );
    }

    private static RssXmlWriter.Item toItem(
            Tenant tenant,
            String originBaseUrl,
            Article article,
            Function<Article, String> linkProvider
    ) {
        String link = linkProvider != null
                ? linkProvider.apply(article)
                : originBaseUrl + "/articles/" + article.getSlug();
        return new RssXmlWriter.Item(
                article.getTitle(),
                link,
                descriptionFor(article),
                "urn:directwerk:article:" + tenant.getSlug() + ":" + article.getId(),
                article.getPublishedAt(),
                null,
                null,
                null,
                null
        );
    }

    /** Same bound the podcast feed applies, so a long archive cannot bloat the document (#720). */
    static final int MAX_DESCRIPTION_CHARS = 4_000;

    private static String descriptionFor(Article article) {
        String fullBody = PublicSurfacePolicy.articleBody(article.getBody(), article.getAccessPolicy().name());
        String text = fullBody != null
                ? fullBody
                : article.getExcerpt() != null ? article.getExcerpt() : "";
        return text.length() > MAX_DESCRIPTION_CHARS
                ? text.substring(0, MAX_DESCRIPTION_CHARS)
                : text;
    }

    private static String channelTitle(Tenant tenant, String channelTitleOverride) {
        if (channelTitleOverride != null && !channelTitleOverride.isBlank()) {
            return channelTitleOverride;
        }
        return tenant.getName();
    }

    static String escapeText(String value) {
        return RssXmlWriter.escapeText(value);
    }

    /**
     * Wraps pre-sanitized content in a CDATA section so readers render rich text as HTML.
     * A literal {@code ]]>} inside the content is split across CDATA boundaries to keep
     * the document well-formed.
     */
    static String cdata(String value) {
        return RssXmlWriter.cdata(value);
    }
}
