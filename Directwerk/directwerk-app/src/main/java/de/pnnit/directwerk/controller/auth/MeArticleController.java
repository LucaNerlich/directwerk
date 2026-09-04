package de.pnnit.directwerk.controller.auth;

import de.pnnit.directwerk.api.PublicArticleViewMapper;
import de.pnnit.directwerk.api.dto.PublicCategoryView;
import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.core.util.ClientIpExtractor;
import de.pnnit.directwerk.modules.digital.DigitalContentModule;
import de.pnnit.directwerk.modules.newsletter.access.SubscriberPortalArticleAccessService;
import de.pnnit.directwerk.modules.newsletter.entity.Article;
import de.pnnit.directwerk.modules.newsletter.service.ArticleViewAnalyticsService;
import de.pnnit.directwerk.multitenancy.TenantContext;
import de.pnnit.directwerk.security.DirectwerkUserPrincipal;
import de.pnnit.directwerk.security.SecurityUtils;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@PreAuthorize("isAuthenticated()")
@RequestMapping("/api/v1/me/articles")
@RequiresModule(DigitalContentModule.KEY)
public class MeArticleController {

    private final SubscriberPortalArticleAccessService subscriberPortalArticleAccessService;
    private final PublicArticleViewMapper publicArticleViewMapper;
    private final ArticleViewAnalyticsService articleViewAnalyticsService;

    public MeArticleController(
            SubscriberPortalArticleAccessService subscriberPortalArticleAccessService,
            PublicArticleViewMapper publicArticleViewMapper,
            ArticleViewAnalyticsService articleViewAnalyticsService
    ) {
        this.subscriberPortalArticleAccessService = subscriberPortalArticleAccessService;
        this.publicArticleViewMapper = publicArticleViewMapper;
        this.articleViewAnalyticsService = articleViewAnalyticsService;
    }

    @GetMapping
    ResponseEntity<Response<List<MeArticleView>>> listArticles(
            @AuthenticationPrincipal DirectwerkUserPrincipal principal
    ) {
        DirectwerkUserPrincipal user = SecurityUtils.requireTenantPrincipal(principal);

        List<MeArticleView> views = subscriberPortalArticleAccessService.listMyArticles(user).stream()
                .map(publicArticleViewMapper::toPortalView)
                .toList();
        return ResponseEntity.ok(Response.ok(views));
    }

    @GetMapping("/{slug}")
    ResponseEntity<Response<MeArticleView>> getArticle(
            @PathVariable String slug,
            @AuthenticationPrincipal DirectwerkUserPrincipal principal,
            HttpServletRequest request
    ) {
        DirectwerkUserPrincipal user = SecurityUtils.requireTenantPrincipal(principal);
        Article article = subscriberPortalArticleAccessService.requireEntitledArticle(user, slug);
        articleViewAnalyticsService.trackArticleView(
                TenantContext.requireTenantId(),
                article,
                "private-view",
                request.getServerName(),
                request.getHeader("User-Agent"),
                ClientIpExtractor.extract(
                        request.getHeader("X-Forwarded-For"),
                        request.getHeader("X-Real-IP"),
                        request.getRemoteAddr()));
        return ResponseEntity.ok(Response.ok(publicArticleViewMapper.toPortalView(article)));
    }

    public record MeArticleView(
            Long id,
            String slug,
            String title,
            String body,
            String excerpt,
            String seoDescription,
            Long heroAssetId,
            String accessPolicy,
            Integer requiredLevelSortOrder,
            Instant publishedAt,
            List<PublicCategoryView> categories
    ) {
    }
}
