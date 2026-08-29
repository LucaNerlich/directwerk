package de.pnnit.directwerk.modules.newsletter.api;

import de.pnnit.directwerk.modules.newsletter.access.PublishedArticleEntitlementGate;
import de.pnnit.directwerk.modules.newsletter.entity.Article;
import de.pnnit.directwerk.modules.subscription.service.EntitlementService;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class ArticleAccessAdapter implements ArticleAccessApi {

    private final EntitlementService entitlementService;
    private final PublishedArticleEntitlementGate publishedArticleEntitlementGate;

    @Override
    public List<Article> filterAccessible(Long tenantId, Long userId, List<Article> articles) {
        Map<Long, EntitlementService.ArticleAccessSubject> subjects = new LinkedHashMap<>();
        for (Article article : articles) {
            subjects.put(article.getId(), ArticleAccessSubjects.toSubject(article));
        }
        Set<Long> accessibleIds = entitlementService.filterAccessibleArticles(tenantId, userId, subjects);
        return articles.stream()
                .filter(article -> accessibleIds.contains(article.getId()))
                .toList();
    }

    @Override
    public boolean hasAccess(Long tenantId, Long userId, Long articleId) {
        return publishedArticleEntitlementGate.hasAccess(tenantId, userId, articleId);
    }
}
