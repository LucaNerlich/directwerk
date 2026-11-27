package de.pnnit.directwerk.modules.newsletter.service;

import de.pnnit.directwerk.modules.newsletter.entity.Article;
import de.pnnit.directwerk.modules.newsletter.entity.ArticleStatus;
import de.pnnit.directwerk.modules.newsletter.exception.ArticleNotFoundException;
import de.pnnit.directwerk.modules.core.util.OffsetLimitPageRequest;
import de.pnnit.directwerk.modules.newsletter.repository.ArticleRepository;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PublicArticleQueryService {

    private final ArticleRepository articleRepository;

    @Transactional(readOnly = true)
    public List<Article> listPublishedArticles(Long tenantId) {
        return articleRepository.findByTenantIdAndStatusOrderByPublishedAtDescIdDesc(
                tenantId,
                ArticleStatus.PUBLISHED
        );
    }

    /**
     * One page of the public catalog (#1036 review): ids are paged in SQL, then the mapped graph
     * is loaded for those ids only. Order follows the id page.
     */
    @Transactional(readOnly = true)
    public List<Article> listPublishedArticles(Long tenantId, int limit, int offset) {
        List<Long> ids = articleRepository.findPublishedIds(
                tenantId,
                ArticleStatus.PUBLISHED,
                OffsetLimitPageRequest.of(limit, offset)
        );
        if (ids.isEmpty()) {
            return List.of();
        }
        Map<Long, Article> byId = new HashMap<>();
        for (Article article : articleRepository.findPublicByIds(tenantId, ids)) {
            byId.put(article.getId(), article);
        }
        return ids.stream().map(byId::get).filter(Objects::nonNull).toList();
    }

    @Transactional(readOnly = true)
    public Article requirePublishedArticle(Long tenantId, String slug) {
        Article article = articleRepository.findByTenantIdAndSlug(tenantId, slug)
                .orElseThrow(() -> new ArticleNotFoundException(slug));
        if (article.getStatus() != ArticleStatus.PUBLISHED) {
            throw new ArticleNotFoundException(slug);
        }
        return article;
    }
}
