package de.pnnit.directwerk.modules.newsletter.service;

import de.pnnit.directwerk.modules.content.WorkingDraftMaps;
import de.pnnit.directwerk.modules.newsletter.entity.Article;
import de.pnnit.directwerk.modules.newsletter.entity.NewsletterList;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Resolves the newsletter-list id set Studio shows for an article: draft overlay when the
 * published working draft carries {@link WorkingDraftMaps#NEWSLETTER_LIST_IDS}, else live joins.
 */
final class ArticleNewsletterAudience {

    private ArticleNewsletterAudience() {
    }

    static boolean hasDraftListOverlay(Article article) {
        Map<String, Object> draft = article.getWorkingDraft();
        return WorkingDraftMaps.isPresent(draft)
                && WorkingDraftMaps.containsKey(draft, WorkingDraftMaps.NEWSLETTER_LIST_IDS);
    }

    static Set<Long> effectiveListIds(Article article) {
        if (hasDraftListOverlay(article)) {
            return new LinkedHashSet<>(WorkingDraftMaps.getLongList(
                    article.getWorkingDraft(), WorkingDraftMaps.NEWSLETTER_LIST_IDS));
        }
        return article.getNewsletterLists().stream()
                .map(NewsletterList::getId)
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }
}
