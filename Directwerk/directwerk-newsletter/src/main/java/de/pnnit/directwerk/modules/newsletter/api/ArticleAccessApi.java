package de.pnnit.directwerk.modules.newsletter.api;

import de.pnnit.directwerk.modules.newsletter.entity.Article;
import java.util.List;

/**
 * Subscriber-side article access decisions for the newsletter module.
 */
public interface ArticleAccessApi {

    /**
     * Returns the subset of {@code articles} the user may access: FREE articles always,
     * paid articles according to active LEVEL/PACKAGE entitlements. Order is preserved.
     */
    List<Article> filterAccessible(Long tenantId, Long userId, List<Article> articles);

    /** Point check for a single published article. */
    boolean hasAccess(Long tenantId, Long userId, Long articleId);
}
