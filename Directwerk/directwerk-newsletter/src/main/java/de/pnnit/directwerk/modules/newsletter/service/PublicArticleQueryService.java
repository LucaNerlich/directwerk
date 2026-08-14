package de.pnnit.directwerk.modules.newsletter.service;

import de.pnnit.directwerk.modules.newsletter.entity.Article;
import de.pnnit.directwerk.modules.newsletter.entity.ArticleStatus;
import de.pnnit.directwerk.modules.newsletter.exception.ArticleNotFoundException;
import de.pnnit.directwerk.modules.newsletter.repository.ArticleRepository;
import java.util.List;
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
