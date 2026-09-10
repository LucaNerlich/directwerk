package de.pnnit.directwerk.controller.newsletter;

import de.pnnit.directwerk.api.MediaAssetViewMapper;
import de.pnnit.directwerk.api.dto.MediaAssetView;
import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.controller.newsletter.ArticleController.ArticleView;
import de.pnnit.directwerk.job.ArticleRssBulkImportPayload;
import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.core.service.UserAccountService;
import de.pnnit.directwerk.modules.digital.api.MediaAssetQueryApi;
import de.pnnit.directwerk.modules.digital.entity.AccessPolicy;
import de.pnnit.directwerk.modules.digital.entity.AssetType;
import de.pnnit.directwerk.modules.digital.entity.AssetVisibility;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.digital.exception.MediaAssetNotFoundException;
import de.pnnit.directwerk.modules.newsletter.ArticlesModule;
import de.pnnit.directwerk.modules.newsletter.exception.ArticleRssImportException;
import de.pnnit.directwerk.modules.newsletter.service.ArticleImportService;
import de.pnnit.directwerk.modules.queue.JobEnqueueMetadata;
import de.pnnit.directwerk.modules.queue.QueueNames;
import de.pnnit.directwerk.modules.queue.QueueService;
import de.pnnit.directwerk.multitenancy.TenantContext;
import de.pnnit.directwerk.security.DirectwerkUserPrincipal;
import de.pnnit.directwerk.security.SecurityUtils;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.ObjectMapper;

@RestController
@RequiresModule(ArticlesModule.KEY)
@PreAuthorize("hasAnyRole('EDITOR', 'TENANT_ADMIN')")
@RequestMapping("/api/v1/articles/import")
public class ArticleImportController {

    private final ArticleImportService articleImportService;
    private final MediaAssetViewMapper mediaAssetViewMapper;
    private final MediaAssetQueryApi mediaAssetQueryApi;
    private final QueueService queueService;
    private final ObjectMapper objectMapper;
    private final UserAccountService userAccountService;

    public ArticleImportController(
            ArticleImportService articleImportService,
            MediaAssetViewMapper mediaAssetViewMapper,
            MediaAssetQueryApi mediaAssetQueryApi,
            QueueService queueService,
            ObjectMapper objectMapper,
            UserAccountService userAccountService
    ) {
        this.articleImportService = articleImportService;
        this.mediaAssetViewMapper = mediaAssetViewMapper;
        this.mediaAssetQueryApi = mediaAssetQueryApi;
        this.queueService = queueService;
        this.objectMapper = objectMapper;
        this.userAccountService = userAccountService;
    }

    @PostMapping("/preview")
    ResponseEntity<Response<PreviewView>> preview(@Valid @RequestBody PreviewRequest request) {
        ArticleImportService.Preview preview = articleImportService.preview(request.feedUrl());
        return ResponseEntity.ok(Response.ok(toPreviewView(preview)));
    }

    @PostMapping("/assets")
    ResponseEntity<Response<MediaAssetView>> ingestAsset(@Valid @RequestBody IngestAssetRequest request) {
        boolean waitForCompletion = request.waitForCompletion() == null || request.waitForCompletion();
        MediaAsset asset = waitForCompletion
                ? articleImportService.ingestAsset(
                        request.sourceUrl(),
                        request.assetType(),
                        request.visibility() == null ? AssetVisibility.PRIVATE : request.visibility(),
                        request.filename()
                )
                : articleImportService.startIngestAsset(
                        request.sourceUrl(),
                        request.assetType(),
                        request.visibility() == null ? AssetVisibility.PRIVATE : request.visibility(),
                        request.filename()
                );
        HttpStatus status = waitForCompletion ? HttpStatus.CREATED : HttpStatus.ACCEPTED;
        return ResponseEntity.status(status).body(
                waitForCompletion
                        ? Response.created(mediaAssetViewMapper.toView(asset))
                        : Response.ok(mediaAssetViewMapper.toView(asset))
        );
    }

    @GetMapping("/assets/{assetId}")
    ResponseEntity<Response<MediaAssetView>> getIngestAsset(@PathVariable @Min(1) Long assetId) {
        MediaAsset asset = mediaAssetQueryApi.findById(assetId)
                .orElseThrow(() -> new MediaAssetNotFoundException(assetId));
        Long tenantId = TenantContext.requireTenantId();
        if (asset.getTenant() == null || !tenantId.equals(asset.getTenant().getId())) {
            throw new MediaAssetNotFoundException(assetId);
        }
        return ResponseEntity.ok(Response.ok(mediaAssetViewMapper.toView(asset)));
    }

    @PostMapping("/articles")
    ResponseEntity<Response<ImportedArticleView>> importArticle(@Valid @RequestBody ImportArticleRequest request) {
        boolean importHero = request.importHero() == null || request.importHero();
        boolean importInline = request.importInlineImages() == null || request.importInlineImages();
        ArticleImportService.ImportedArticle imported = articleImportService.importArticle(
                new ArticleImportService.ImportArticleCommand(
                        request.feedUrl(),
                        request.guid(),
                        request.slug(),
                        request.title(),
                        request.body(),
                        request.excerpt(),
                        request.accessPolicy(),
                        request.requiredLevelSortOrder(),
                        request.categoryIds(),
                        request.imageUrl(),
                        request.heroAssetId(),
                        importHero,
                        importInline,
                        request.publishedAt()
                )
        );
        HttpStatus status = imported.alreadyImported() ? HttpStatus.OK : HttpStatus.CREATED;
        ImportedArticleView view = new ImportedArticleView(
                ArticleController.toView(imported.article()),
                imported.alreadyImported()
        );
        return ResponseEntity.status(status).body(
                imported.alreadyImported() ? Response.ok(view) : Response.created(view)
        );
    }

    @PostMapping("/bulk")
    ResponseEntity<Response<BulkImportQueuedView>> importBulk(
            @Valid @RequestBody BulkImportRequest request,
            @AuthenticationPrincipal DirectwerkUserPrincipal principal
    ) {
        DirectwerkUserPrincipal user = SecurityUtils.requireTenantPrincipal(principal);
        Long tenantId = user.tenantId();
        var account = userAccountService.findAccount(user.userId()).orElse(null);
        if (account == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Response.error(404, "USER_NOT_FOUND", "User not found"));
        }

        ArticleImportService.Preview preview = articleImportService.preview(request.feedUrl());
        if (preview.truncated()) {
            throw new ArticleRssImportException(
                    400,
                    "RSS_FEED_INVALID",
                    "A truncated RSS feed preview cannot be used for bulk import"
            );
        }
        long alreadyImported = preview.articles().stream()
                .filter(article -> article.alreadyImportedArticleId() != null)
                .count();

        ArticleRssBulkImportPayload payload = new ArticleRssBulkImportPayload(
                preview.feedUrl(),
                request.categoryIds(),
                request.accessPolicy(),
                request.requiredLevelSortOrder(),
                request.importHero() == null || request.importHero(),
                request.importInlineImages() == null || request.importInlineImages(),
                account.email(),
                account.name()
        );
        var job = queueService.enqueue(
                QueueNames.ARTICLE_RSS_BULK_IMPORT,
                objectMapper.valueToTree(payload),
                0,
                null,
                null,
                new JobEnqueueMetadata(
                        tenantId,
                        "article-rss-bulk-import-" + tenantId + "-" + feedHash(preview.feedUrl()),
                        null
                )
        );
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(Response.ok(new BulkImportQueuedView(
                job.id().toString(),
                preview.articles().size(),
                (int) alreadyImported,
                account.email()
        )));
    }

    private static String feedHash(String feedUrl) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(feedUrl.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest).substring(0, 16);
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 unavailable", ex);
        }
    }

    private static PreviewView toPreviewView(ArticleImportService.Preview preview) {
        return new PreviewView(
                preview.feedUrl(),
                new ChannelView(
                        preview.channel().title(),
                        preview.channel().description(),
                        preview.channel().language(),
                        preview.channel().imageUrl(),
                        preview.channel().link(),
                        preview.channel().suggestedSlug()
                ),
                preview.articles().stream()
                        .map(item -> new ArticlePreviewView(
                                item.guid(),
                                item.title(),
                                item.body(),
                                item.excerpt(),
                                item.publishedAt() == null ? null : item.publishedAt().toString(),
                                item.imageUrl(),
                                item.suggestedSlug(),
                                item.alreadyImportedArticleId()
                        ))
                        .toList(),
                preview.truncated()
        );
    }

    public record PreviewRequest(@NotBlank @Size(max = 2048) String feedUrl) {
    }

    public record BulkImportRequest(
            @NotBlank @Size(max = 2048) String feedUrl,
            Set<@Min(1) Long> categoryIds,
            AccessPolicy accessPolicy,
            @Min(0) Integer requiredLevelSortOrder,
            Boolean importHero,
            Boolean importInlineImages
    ) {
    }

    public record BulkImportQueuedView(
            String jobId,
            int totalArticles,
            int alreadyImported,
            String notifyEmail
    ) {
    }

    public record IngestAssetRequest(
            @NotBlank @Size(max = 2048) String sourceUrl,
            @NotNull AssetType assetType,
            AssetVisibility visibility,
            @Size(max = 180) String filename,
            Boolean waitForCompletion
    ) {
    }

    public record ImportArticleRequest(
            @NotBlank @Size(max = 2048) String feedUrl,
            @NotBlank @Size(max = 512) String guid,
            @Pattern(regexp = "^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,62}[a-zA-Z0-9])?$")
            String slug,
            @NotBlank @Size(max = 255) String title,
            String body,
            String excerpt,
            AccessPolicy accessPolicy,
            @Min(0) Integer requiredLevelSortOrder,
            Set<@Min(1) Long> categoryIds,
            @Size(max = 2048) String imageUrl,
            @Min(1) Long heroAssetId,
            Boolean importHero,
            Boolean importInlineImages,
            Instant publishedAt
    ) {
    }

    public record PreviewView(
            String feedUrl,
            ChannelView channel,
            List<ArticlePreviewView> articles,
            boolean truncated
    ) {
    }

    public record ChannelView(
            String title,
            String description,
            String language,
            String imageUrl,
            String link,
            String suggestedSlug
    ) {
    }

    public record ArticlePreviewView(
            String guid,
            String title,
            String body,
            String excerpt,
            String publishedAt,
            String imageUrl,
            String suggestedSlug,
            Long alreadyImportedArticleId
    ) {
    }

    public record ImportedArticleView(
            ArticleView article,
            boolean alreadyImported
    ) {
    }
}
