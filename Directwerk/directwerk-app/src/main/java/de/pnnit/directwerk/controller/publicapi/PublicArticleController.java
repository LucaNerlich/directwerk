package de.pnnit.directwerk.controller.publicapi;

import de.pnnit.directwerk.api.PublicArticleViewMapper;
import de.pnnit.directwerk.api.dto.PublicCategoryView;
import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.digital.DigitalContentModule;
import de.pnnit.directwerk.modules.newsletter.service.PublicArticleQueryService;
import de.pnnit.directwerk.multitenancy.TenantContext;
import java.time.Instant;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/public")
@RequiresModule(DigitalContentModule.KEY)
public class PublicArticleController {

    private final PublicArticleQueryService publicArticleQueryService;
    private final PublicArticleViewMapper publicArticleViewMapper;

    public PublicArticleController(
            PublicArticleQueryService publicArticleQueryService,
            PublicArticleViewMapper publicArticleViewMapper
    ) {
        this.publicArticleQueryService = publicArticleQueryService;
        this.publicArticleViewMapper = publicArticleViewMapper;
    }

    @GetMapping("/articles")
    ResponseEntity<Response<List<PublicArticleView>>> listArticles() {
        Long tenantId = TenantContext.getTenantId();
        List<PublicArticleView> articles = publicArticleQueryService.listPublishedArticles(tenantId).stream()
                .map(publicArticleViewMapper::toPublicView)
                .toList();
        return ResponseEntity.ok(Response.ok(articles));
    }

    @GetMapping("/articles/{slug}")
    ResponseEntity<Response<PublicArticleView>> getArticle(@PathVariable String slug) {
        Long tenantId = TenantContext.getTenantId();
        return ResponseEntity.ok(Response.ok(publicArticleViewMapper.toPublicView(
                publicArticleQueryService.requirePublishedArticle(tenantId, slug)
        )));
    }

    public record PublicArticleView(
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
