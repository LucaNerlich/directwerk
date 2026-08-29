package de.pnnit.directwerk.modules.newsletter.service;

import de.pnnit.directwerk.modules.newsletter.api.ArticleAccessApi;
import de.pnnit.directwerk.modules.newsletter.entity.Article;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class SubscriberArticleService {

    private final PublicArticleQueryService publicArticleQueryService;
    private final ArticleAccessApi articleAccessApi;

    @Transactional(readOnly = true)
    public List<Article> listPublishedArticles(Long tenantId) {
        return publicArticleQueryService.listPublishedArticles(tenantId);
    }

    /**
     * One batched entitlement evaluation for the whole list — no per-article subscription lookups.
     */
    @Transactional(readOnly = true)
    public List<Article> listEntitledArticles(Long tenantId, Long userId) {
        return articleAccessApi.filterAccessible(tenantId, userId, listPublishedArticles(tenantId));
    }
}
