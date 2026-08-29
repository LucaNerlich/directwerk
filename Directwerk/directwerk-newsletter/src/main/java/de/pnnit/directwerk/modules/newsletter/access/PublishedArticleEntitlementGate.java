package de.pnnit.directwerk.modules.newsletter.access;

import de.pnnit.directwerk.modules.newsletter.api.ArticleAccessSubjects;
import de.pnnit.directwerk.modules.newsletter.entity.ArticleStatus;
import de.pnnit.directwerk.modules.newsletter.repository.ArticleRepository;
import de.pnnit.directwerk.modules.subscription.service.EntitlementService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Canonical published-article entitlement check shared by article access adapters.
 */
@Component
@RequiredArgsConstructor
public class PublishedArticleEntitlementGate {

    private final ArticleRepository articleRepository;
    private final EntitlementService entitlementService;

    public boolean hasAccess(Long tenantId, Long userId, Long articleId) {
        return articleRepository.findByIdAndTenantId(articleId, tenantId)
                .filter(article -> article.getStatus() == ArticleStatus.PUBLISHED)
                .map(article -> entitlementService.hasArticleAccess(
                        tenantId, userId, ArticleAccessSubjects.toSubject(article)))
                .orElse(false);
    }
}
