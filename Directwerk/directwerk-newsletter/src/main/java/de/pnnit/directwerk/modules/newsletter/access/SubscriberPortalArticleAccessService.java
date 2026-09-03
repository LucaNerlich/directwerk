package de.pnnit.directwerk.modules.newsletter.access;

import de.pnnit.directwerk.modules.digital.DigitalContentModule;
import de.pnnit.directwerk.modules.newsletter.entity.Article;
import de.pnnit.directwerk.modules.newsletter.service.PublicArticleQueryService;
import de.pnnit.directwerk.modules.newsletter.service.SubscriberArticleService;
import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import de.pnnit.directwerk.multitenancy.TenantContext;
import de.pnnit.directwerk.security.DirectwerkUserPrincipal;
import de.pnnit.directwerk.security.RoleConstants;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * JWT subscriber portal access: entitled article library listing.
 */
@Service
@RequiredArgsConstructor
public class SubscriberPortalArticleAccessService {

    private final SubscriberArticleService subscriberArticleService;
    private final PublicArticleQueryService publicArticleQueryService;
    private final ModuleGateService moduleGateService;

    @Transactional(readOnly = true)
    public List<Article> listMyArticles(DirectwerkUserPrincipal user) {
        Long tenantId = TenantContext.requireTenantId();
        moduleGateService.requireModule(DigitalContentModule.KEY);

        return RoleConstants.isEditorOrTenantAdmin(user)
                ? subscriberArticleService.listPublishedArticles(tenantId)
                : subscriberArticleService.listEntitledArticles(tenantId, user.userId());
    }

    @Transactional(readOnly = true)
    public Article requireEntitledArticle(DirectwerkUserPrincipal user, String slug) {
        Long tenantId = TenantContext.requireTenantId();
        moduleGateService.requireModule(DigitalContentModule.KEY);
        Article article = publicArticleQueryService.requirePublishedArticle(tenantId, slug);
        if (RoleConstants.isEditorOrTenantAdmin(user)) {
            return article;
        }
        boolean allowed = subscriberArticleService.listEntitledArticles(tenantId, user.userId()).stream()
                .anyMatch(candidate -> candidate.getId().equals(article.getId()));
        if (!allowed) {
            throw new de.pnnit.directwerk.modules.newsletter.exception.ArticleNotFoundException(slug);
        }
        return article;
    }
}
