package de.pnnit.directwerk.controller.auth;

import de.pnnit.directwerk.api.PublicArticleViewMapper;
import de.pnnit.directwerk.api.dto.PublicCategoryView;
import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.digital.DigitalContentModule;
import de.pnnit.directwerk.modules.newsletter.access.SubscriberPortalArticleAccessService;
import de.pnnit.directwerk.security.DirectwerkUserPrincipal;
import de.pnnit.directwerk.security.SecurityUtils;
import java.time.Instant;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@PreAuthorize("isAuthenticated()")
@RequestMapping("/api/v1/me/articles")
@RequiresModule(DigitalContentModule.KEY)
public class MeArticleController {

    private final SubscriberPortalArticleAccessService subscriberPortalArticleAccessService;
    private final PublicArticleViewMapper publicArticleViewMapper;

    public MeArticleController(
            SubscriberPortalArticleAccessService subscriberPortalArticleAccessService,
            PublicArticleViewMapper publicArticleViewMapper
    ) {
        this.subscriberPortalArticleAccessService = subscriberPortalArticleAccessService;
        this.publicArticleViewMapper = publicArticleViewMapper;
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
