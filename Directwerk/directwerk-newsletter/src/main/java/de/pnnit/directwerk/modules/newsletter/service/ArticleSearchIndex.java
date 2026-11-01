package de.pnnit.directwerk.modules.newsletter.service;

import de.pnnit.directwerk.modules.newsletter.entity.Article;
import de.pnnit.directwerk.modules.newsletter.entity.ArticleStatus;
import de.pnnit.directwerk.modules.search.SearchIndex;
import de.pnnit.directwerk.modules.search.SearchIndexDraft;
import de.pnnit.directwerk.modules.search.SearchKinds;

final class ArticleSearchIndex {

    private ArticleSearchIndex() {
    }

    static void mirror(SearchIndex index, Article article) {
        if (article.getId() == null || article.getTenant() == null || article.getTenant().getId() == null) {
            return;
        }
        long tenantId = article.getTenant().getId();
        if (article.getStatus() == ArticleStatus.PUBLISHED) {
            index.sync(new SearchIndexDraft(
                    tenantId,
                    SearchKinds.ARTICLE,
                    article.getId(),
                    article.getTitle(),
                    article.getSlug(),
                    article.getBody(),
                    article.getExcerpt(),
                    "/articles/" + article.getSlug(),
                    article.getAccessPolicy().name()
            ));
            return;
        }
        index.remove(tenantId, SearchKinds.ARTICLE, article.getId());
    }

    static void remove(SearchIndex index, long tenantId, long articleId) {
        index.remove(tenantId, SearchKinds.ARTICLE, articleId);
    }
}
