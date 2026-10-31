package de.pnnit.directwerk.mcp;

import static de.pnnit.directwerk.mcp.StudioMcpApiClient.args;
import static de.pnnit.directwerk.mcp.StudioMcpApiClient.longArg;
import static de.pnnit.directwerk.mcp.StudioMcpApiClient.optionalLong;
import static de.pnnit.directwerk.mcp.StudioMcpApiClient.queryOf;
import static de.pnnit.directwerk.mcp.StudioMcpApiClient.withoutKeys;

import io.modelcontextprotocol.json.McpJsonMapper;
import io.modelcontextprotocol.server.McpStatelessServerFeatures;
import io.modelcontextprotocol.spec.McpSchema;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.BiFunction;
import org.springframework.stereotype.Component;

/**
 * Hosted MCP tool catalog — mirrors {@code packages/mcp-studio/src/server.ts}
 * (except {@code import_podcast_manifest}, which needs a local filesystem).
 */
@Component
public class StudioMcpTools {

    private final StudioMcpApiClient api;
    private final McpJsonMapper jsonMapper;

    public StudioMcpTools(StudioMcpApiClient api, McpJsonMapper jsonMapper) {
        this.api = api;
        this.jsonMapper = jsonMapper;
    }

    public List<McpStatelessServerFeatures.SyncToolSpecification> specifications() {
        List<McpStatelessServerFeatures.SyncToolSpecification> tools = new ArrayList<>();

        // Articles
        tools.add(tool("list_articles", "List articles for the tenant", """
                {"type":"object","properties":{"limit":{"type":"integer","minimum":1,"maximum":100},"offset":{"type":"integer","minimum":0}},"additionalProperties":false}
                """, (ctx, req) -> api.get(ctx, "/api/v1/articles", queryOf(args(req), "limit", "offset"))));
        tools.add(tool("get_article", "Get one article by id", """
                {"type":"object","properties":{"articleId":{"type":"integer","minimum":1}},"required":["articleId"],"additionalProperties":false}
                """, (ctx, req) -> api.get(ctx, "/api/v1/articles/" + longArg(args(req), "articleId"), null)));
        tools.add(tool("create_article", "Create an article", """
                {"type":"object","properties":{"slug":{"type":"string","minLength":1,"maxLength":120},"title":{"type":"string","minLength":1,"maxLength":500},"body":{"type":"string"},"excerpt":{"type":"string"},"seoDescription":{"type":"string"},"accessPolicy":{"type":"string","enum":["FREE","PAID"]},"heroAssetId":{"type":"integer","minimum":1},"requiredLevelSortOrder":{"type":"integer"}},"required":["slug","title","accessPolicy"],"additionalProperties":false}
                """, (ctx, req) -> api.post(ctx, "/api/v1/articles", args(req))));
        tools.add(tool("update_article", "Update an article", """
                {"type":"object","properties":{"articleId":{"type":"integer","minimum":1},"slug":{"type":"string","minLength":1,"maxLength":120},"title":{"type":"string","minLength":1,"maxLength":500},"body":{"type":"string"},"excerpt":{"type":"string"},"seoDescription":{"type":"string"},"accessPolicy":{"type":"string","enum":["FREE","PAID"]},"heroAssetId":{"type":"integer","minimum":1},"clearHeroAsset":{"type":"boolean"},"requiredLevelSortOrder":{"type":"integer"}},"required":["articleId"],"additionalProperties":false}
                """, (ctx, req) -> {
            Map<String, Object> a = args(req);
            return api.put(ctx, "/api/v1/articles/" + longArg(a, "articleId"), withoutKeys(a, "articleId"));
        }));
        tools.add(tool("delete_article", "Delete an article", """
                {"type":"object","properties":{"articleId":{"type":"integer","minimum":1}},"required":["articleId"],"additionalProperties":false}
                """, (ctx, req) -> api.delete(ctx, "/api/v1/articles/" + longArg(args(req), "articleId"))));
        tools.add(tool("set_article_categories", "Replace article categories", """
                {"type":"object","properties":{"articleId":{"type":"integer","minimum":1},"categoryIds":{"type":"array","items":{"type":"integer","minimum":1}}},"required":["articleId","categoryIds"],"additionalProperties":false}
                """, (ctx, req) -> {
            Map<String, Object> a = args(req);
            return api.put(ctx, "/api/v1/articles/" + longArg(a, "articleId") + "/categories",
                    Map.of("categoryIds", a.get("categoryIds")));
        }));
        tools.add(tool("publish_article", "Publish an article", """
                {"type":"object","properties":{"articleId":{"type":"integer","minimum":1},"notifySubscribers":{"type":"boolean"},"publishedAt":{"type":"string"}},"required":["articleId"],"additionalProperties":false}
                """, (ctx, req) -> {
            Map<String, Object> a = args(req);
            Map<String, Object> body = new LinkedHashMap<>();
            if (a.containsKey("notifySubscribers")) {
                body.put("notifySubscribers", a.get("notifySubscribers"));
            }
            if (a.containsKey("publishedAt")) {
                body.put("publishedAt", a.get("publishedAt"));
            }
            return api.post(ctx, "/api/v1/articles/" + longArg(a, "articleId") + "/publish", body);
        }));
        tools.add(tool("unpublish_article", "Unpublish an article", """
                {"type":"object","properties":{"articleId":{"type":"integer","minimum":1}},"required":["articleId"],"additionalProperties":false}
                """, (ctx, req) -> api.post(ctx, "/api/v1/articles/" + longArg(args(req), "articleId") + "/unpublish", Map.of())));
        tools.add(tool("schedule_article",
                "Schedule an article publish time (field matches backend: scheduledAt)", """
                {"type":"object","properties":{"articleId":{"type":"integer","minimum":1},"scheduledAt":{"type":"string","minLength":1},"notifySubscribers":{"type":"boolean"}},"required":["articleId","scheduledAt"],"additionalProperties":false}
                """, (ctx, req) -> {
            Map<String, Object> a = args(req);
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("scheduledAt", a.get("scheduledAt"));
            if (a.containsKey("notifySubscribers")) {
                body.put("notifySubscribers", a.get("notifySubscribers"));
            }
            return api.post(ctx, "/api/v1/articles/" + longArg(a, "articleId") + "/schedule", body);
        }));
        tools.add(tool("cancel_schedule_article", "Cancel a scheduled article publish", """
                {"type":"object","properties":{"articleId":{"type":"integer","minimum":1}},"required":["articleId"],"additionalProperties":false}
                """, (ctx, req) -> api.post(ctx, "/api/v1/articles/" + longArg(args(req), "articleId") + "/cancel-schedule", Map.of())));
        tools.add(tool("archive_article", "Archive an article", """
                {"type":"object","properties":{"articleId":{"type":"integer","minimum":1}},"required":["articleId"],"additionalProperties":false}
                """, (ctx, req) -> api.post(ctx, "/api/v1/articles/" + longArg(args(req), "articleId") + "/archive", Map.of())));
        tools.add(tool("unarchive_article", "Unarchive an article", """
                {"type":"object","properties":{"articleId":{"type":"integer","minimum":1}},"required":["articleId"],"additionalProperties":false}
                """, (ctx, req) -> api.post(ctx, "/api/v1/articles/" + longArg(args(req), "articleId") + "/unarchive", Map.of())));
        tools.add(tool("notify_preview_article", "Preview subscriber notification recipients for an article", """
                {"type":"object","properties":{"articleId":{"type":"integer","minimum":1}},"required":["articleId"],"additionalProperties":false}
                """, (ctx, req) -> api.get(ctx, "/api/v1/articles/" + longArg(args(req), "articleId") + "/notify-preview", null)));
        tools.add(tool("notify_article", "Send or retry subscriber notification for a published article", """
                {"type":"object","properties":{"articleId":{"type":"integer","minimum":1}},"required":["articleId"],"additionalProperties":false}
                """, (ctx, req) -> api.post(ctx, "/api/v1/articles/" + longArg(args(req), "articleId") + "/notify", Map.of())));
        tools.add(tool("set_article_newsletter_lists",
                "Replace article newsletter list attachments (list ids must already be known; list CRUD is not in MCP)", """
                {"type":"object","properties":{"articleId":{"type":"integer","minimum":1},"newsletterListIds":{"type":"array","items":{"type":"integer","minimum":1}}},"required":["articleId","newsletterListIds"],"additionalProperties":false}
                """, (ctx, req) -> {
            Map<String, Object> a = args(req);
            return api.put(ctx, "/api/v1/articles/" + longArg(a, "articleId") + "/newsletter-lists",
                    Map.of("newsletterListIds", a.get("newsletterListIds")));
        }));
        tools.add(tool("bulk_publish_articles", "Publish multiple articles (1-100 ids, atomic)", """
                {"type":"object","properties":{"ids":{"type":"array","items":{"type":"integer","minimum":1},"minItems":1,"maxItems":100},"notifySubscribers":{"type":"boolean"},"publishedAt":{"type":"string"}},"required":["ids"],"additionalProperties":false}
                """, (ctx, req) -> {
            Map<String, Object> a = args(req);
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("ids", a.get("ids"));
            if (a.containsKey("notifySubscribers")) {
                body.put("notifySubscribers", a.get("notifySubscribers"));
            }
            if (a.containsKey("publishedAt")) {
                body.put("publishedAt", a.get("publishedAt"));
            }
            return api.post(ctx, "/api/v1/articles/bulk/publish", body);
        }));
        tools.add(tool("bulk_unpublish_articles", "Unpublish multiple articles (1-100 ids, atomic)", """
                {"type":"object","properties":{"ids":{"type":"array","items":{"type":"integer","minimum":1},"minItems":1,"maxItems":100}},"required":["ids"],"additionalProperties":false}
                """, (ctx, req) -> api.post(ctx, "/api/v1/articles/bulk/unpublish", Map.of("ids", args(req).get("ids")))));
        tools.add(tool("bulk_delete_articles", "Delete multiple articles (1-100 ids, atomic)", """
                {"type":"object","properties":{"ids":{"type":"array","items":{"type":"integer","minimum":1},"minItems":1,"maxItems":100}},"required":["ids"],"additionalProperties":false}
                """, (ctx, req) -> api.post(ctx, "/api/v1/articles/bulk/delete", Map.of("ids", args(req).get("ids")))));

        // Episodes
        tools.add(tool("list_episodes", "List episodes for the tenant", """
                {"type":"object","properties":{"limit":{"type":"integer","minimum":1,"maximum":100},"offset":{"type":"integer","minimum":0}},"additionalProperties":false}
                """, (ctx, req) -> api.get(ctx, "/api/v1/episodes", queryOf(args(req), "limit", "offset"))));
        tools.add(tool("get_episode", "Get one episode by id", """
                {"type":"object","properties":{"episodeId":{"type":"integer","minimum":1}},"required":["episodeId"],"additionalProperties":false}
                """, (ctx, req) -> api.get(ctx, "/api/v1/episodes/" + longArg(args(req), "episodeId"), null)));
        tools.add(tool("create_episode", "Create an episode", """
                {"type":"object","properties":{"seriesId":{"type":"integer","minimum":1},"slug":{"type":"string","minLength":1,"maxLength":120},"title":{"type":"string","minLength":1,"maxLength":500},"description":{"type":"string"},"accessPolicy":{"type":"string","enum":["FREE","PAID"]},"episodeNumber":{"type":"integer"},"requiredLevelSortOrder":{"type":"integer"},"coverAssetId":{"type":"integer","minimum":1}},"required":["seriesId","slug","title","accessPolicy"],"additionalProperties":false}
                """, (ctx, req) -> api.post(ctx, "/api/v1/episodes", args(req))));
        tools.add(tool("update_episode", "Update an episode", """
                {"type":"object","properties":{"episodeId":{"type":"integer","minimum":1},"slug":{"type":"string","minLength":1,"maxLength":120},"title":{"type":"string","minLength":1,"maxLength":500},"description":{"type":"string"},"accessPolicy":{"type":"string","enum":["FREE","PAID"]},"episodeNumber":{"type":"integer"},"requiredLevelSortOrder":{"type":"integer"},"coverAssetId":{"type":"integer","minimum":1},"clearCoverAsset":{"type":"boolean"}},"required":["episodeId"],"additionalProperties":false}
                """, (ctx, req) -> {
            Map<String, Object> a = args(req);
            return api.put(ctx, "/api/v1/episodes/" + longArg(a, "episodeId"), withoutKeys(a, "episodeId"));
        }));
        tools.add(tool("delete_episode", "Delete an episode", """
                {"type":"object","properties":{"episodeId":{"type":"integer","minimum":1}},"required":["episodeId"],"additionalProperties":false}
                """, (ctx, req) -> api.delete(ctx, "/api/v1/episodes/" + longArg(args(req), "episodeId"))));
        tools.add(tool("set_episode_formats", "Replace episode formats", """
                {"type":"object","properties":{"episodeId":{"type":"integer","minimum":1},"formatIds":{"type":"array","items":{"type":"integer","minimum":1}}},"required":["episodeId","formatIds"],"additionalProperties":false}
                """, (ctx, req) -> {
            Map<String, Object> a = args(req);
            return api.put(ctx, "/api/v1/episodes/" + longArg(a, "episodeId") + "/formats",
                    Map.of("formatIds", a.get("formatIds")));
        }));
        tools.add(tool("set_episode_categories", "Replace episode categories", """
                {"type":"object","properties":{"episodeId":{"type":"integer","minimum":1},"categoryIds":{"type":"array","items":{"type":"integer","minimum":1}}},"required":["episodeId","categoryIds"],"additionalProperties":false}
                """, (ctx, req) -> {
            Map<String, Object> a = args(req);
            return api.put(ctx, "/api/v1/episodes/" + longArg(a, "episodeId") + "/categories",
                    Map.of("categoryIds", a.get("categoryIds")));
        }));
        tools.add(tool("attach_episode_audio", "Attach a media asset as episode audio", """
                {"type":"object","properties":{"episodeId":{"type":"integer","minimum":1},"audioAssetId":{"type":"integer","minimum":1}},"required":["episodeId","audioAssetId"],"additionalProperties":false}
                """, (ctx, req) -> {
            Map<String, Object> a = args(req);
            return api.post(ctx, "/api/v1/episodes/" + longArg(a, "episodeId") + "/audio",
                    Map.of("audioAssetId", longArg(a, "audioAssetId")));
        }));
        tools.add(tool("publish_episode",
                "Publish an episode (optionally with an explicit publish date for imports)", """
                {"type":"object","properties":{"episodeId":{"type":"integer","minimum":1},"notifySubscribers":{"type":"boolean"},"publishedAt":{"type":"string"}},"required":["episodeId"],"additionalProperties":false}
                """, (ctx, req) -> {
            Map<String, Object> a = args(req);
            Map<String, Object> body = new LinkedHashMap<>();
            if (a.containsKey("notifySubscribers")) {
                body.put("notifySubscribers", a.get("notifySubscribers"));
            }
            if (a.containsKey("publishedAt")) {
                body.put("publishedAt", a.get("publishedAt"));
            }
            return api.post(ctx, "/api/v1/episodes/" + longArg(a, "episodeId") + "/publish", body);
        }));
        tools.add(tool("unpublish_episode", "Unpublish an episode", """
                {"type":"object","properties":{"episodeId":{"type":"integer","minimum":1}},"required":["episodeId"],"additionalProperties":false}
                """, (ctx, req) -> api.post(ctx, "/api/v1/episodes/" + longArg(args(req), "episodeId") + "/unpublish", Map.of())));
        tools.add(tool("schedule_episode",
                "Schedule an episode publish time (field matches backend: scheduledAt)", """
                {"type":"object","properties":{"episodeId":{"type":"integer","minimum":1},"scheduledAt":{"type":"string","minLength":1},"notifySubscribers":{"type":"boolean"}},"required":["episodeId","scheduledAt"],"additionalProperties":false}
                """, (ctx, req) -> {
            Map<String, Object> a = args(req);
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("scheduledAt", a.get("scheduledAt"));
            if (a.containsKey("notifySubscribers")) {
                body.put("notifySubscribers", a.get("notifySubscribers"));
            }
            return api.post(ctx, "/api/v1/episodes/" + longArg(a, "episodeId") + "/schedule", body);
        }));
        tools.add(tool("cancel_schedule_episode", "Cancel a scheduled episode publish", """
                {"type":"object","properties":{"episodeId":{"type":"integer","minimum":1}},"required":["episodeId"],"additionalProperties":false}
                """, (ctx, req) -> api.post(ctx, "/api/v1/episodes/" + longArg(args(req), "episodeId") + "/cancel-schedule", Map.of())));
        tools.add(tool("archive_episode", "Archive an episode", """
                {"type":"object","properties":{"episodeId":{"type":"integer","minimum":1}},"required":["episodeId"],"additionalProperties":false}
                """, (ctx, req) -> api.post(ctx, "/api/v1/episodes/" + longArg(args(req), "episodeId") + "/archive", Map.of())));
        tools.add(tool("unarchive_episode", "Unarchive an episode", """
                {"type":"object","properties":{"episodeId":{"type":"integer","minimum":1}},"required":["episodeId"],"additionalProperties":false}
                """, (ctx, req) -> api.post(ctx, "/api/v1/episodes/" + longArg(args(req), "episodeId") + "/unarchive", Map.of())));
        tools.add(tool("set_episode_enclosure_enabled", "Enable or disable the RSS enclosure for an episode", """
                {"type":"object","properties":{"episodeId":{"type":"integer","minimum":1},"enabled":{"type":"boolean"}},"required":["episodeId","enabled"],"additionalProperties":false}
                """, (ctx, req) -> {
            Map<String, Object> a = args(req);
            return api.put(ctx, "/api/v1/episodes/" + longArg(a, "episodeId") + "/enclosure-enabled",
                    Map.of("enabled", a.get("enabled")));
        }));
        tools.add(tool("notify_preview_episode", "Preview subscriber notification recipients for an episode", """
                {"type":"object","properties":{"episodeId":{"type":"integer","minimum":1}},"required":["episodeId"],"additionalProperties":false}
                """, (ctx, req) -> api.get(ctx, "/api/v1/episodes/" + longArg(args(req), "episodeId") + "/notify-preview", null)));
        tools.add(tool("notify_episode", "Send or retry subscriber notification for a published episode", """
                {"type":"object","properties":{"episodeId":{"type":"integer","minimum":1}},"required":["episodeId"],"additionalProperties":false}
                """, (ctx, req) -> api.post(ctx, "/api/v1/episodes/" + longArg(args(req), "episodeId") + "/notify", Map.of())));
        tools.add(tool("bulk_publish_episodes", "Publish multiple episodes (1-100 ids, atomic)", """
                {"type":"object","properties":{"ids":{"type":"array","items":{"type":"integer","minimum":1},"minItems":1,"maxItems":100},"notifySubscribers":{"type":"boolean"},"publishedAt":{"type":"string"}},"required":["ids"],"additionalProperties":false}
                """, (ctx, req) -> {
            Map<String, Object> a = args(req);
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("ids", a.get("ids"));
            if (a.containsKey("notifySubscribers")) {
                body.put("notifySubscribers", a.get("notifySubscribers"));
            }
            if (a.containsKey("publishedAt")) {
                body.put("publishedAt", a.get("publishedAt"));
            }
            return api.post(ctx, "/api/v1/episodes/bulk/publish", body);
        }));
        tools.add(tool("bulk_unpublish_episodes", "Unpublish multiple episodes (1-100 ids, atomic)", """
                {"type":"object","properties":{"ids":{"type":"array","items":{"type":"integer","minimum":1},"minItems":1,"maxItems":100}},"required":["ids"],"additionalProperties":false}
                """, (ctx, req) -> api.post(ctx, "/api/v1/episodes/bulk/unpublish", Map.of("ids", args(req).get("ids")))));
        tools.add(tool("bulk_delete_episodes", "Delete multiple episodes (1-100 ids, atomic)", """
                {"type":"object","properties":{"ids":{"type":"array","items":{"type":"integer","minimum":1},"minItems":1,"maxItems":100}},"required":["ids"],"additionalProperties":false}
                """, (ctx, req) -> api.post(ctx, "/api/v1/episodes/bulk/delete", Map.of("ids", args(req).get("ids")))));

        // Series
        tools.add(tool("list_series", "List podcast series", """
                {"type":"object","properties":{"limit":{"type":"integer","minimum":1,"maximum":100},"offset":{"type":"integer","minimum":0}},"additionalProperties":false}
                """, (ctx, req) -> api.get(ctx, "/api/v1/series", queryOf(args(req), "limit", "offset"))));
        tools.add(tool("get_series", "Get one series by id", """
                {"type":"object","properties":{"seriesId":{"type":"integer","minimum":1}},"required":["seriesId"],"additionalProperties":false}
                """, (ctx, req) -> api.get(ctx, "/api/v1/series/" + longArg(args(req), "seriesId"), null)));
        tools.add(tool("create_series", "Create a podcast series", """
                {"type":"object","properties":{"slug":{"type":"string","minLength":1,"maxLength":120},"title":{"type":"string","minLength":1,"maxLength":500},"description":{"type":"string"},"coverAssetId":{"type":"integer","minimum":1},"language":{"type":"string"},"itunesCategory":{"type":"string"},"itunesExplicit":{"type":"boolean"},"defaultRequiredLevelSortOrder":{"type":"integer"}},"required":["slug","title"],"additionalProperties":false}
                """, (ctx, req) -> api.post(ctx, "/api/v1/series", args(req))));
        tools.add(tool("update_series", "Update a podcast series", """
                {"type":"object","properties":{"seriesId":{"type":"integer","minimum":1},"slug":{"type":"string","minLength":1,"maxLength":120},"title":{"type":"string","minLength":1,"maxLength":500},"description":{"type":"string"},"coverAssetId":{"type":"integer","minimum":1},"language":{"type":"string"},"itunesCategory":{"type":"string"},"itunesExplicit":{"type":"boolean"},"defaultRequiredLevelSortOrder":{"type":"integer"},"status":{"type":"string","enum":["DRAFT","PUBLISHED"]}},"required":["seriesId"],"additionalProperties":false}
                """, (ctx, req) -> {
            Map<String, Object> a = args(req);
            return api.put(ctx, "/api/v1/series/" + longArg(a, "seriesId"), withoutKeys(a, "seriesId"));
        }));

        // Categories
        tools.add(tool("list_categories", "List tenant categories", """
                {"type":"object","properties":{},"additionalProperties":false}
                """, (ctx, req) -> api.get(ctx, "/api/v1/categories", null)));
        tools.add(tool("create_category", "Create a category", """
                {"type":"object","properties":{"slug":{"type":"string","minLength":1,"maxLength":120},"name":{"type":"string","minLength":1,"maxLength":200},"parentId":{"type":"integer","minimum":1}},"required":["slug","name"],"additionalProperties":false}
                """, (ctx, req) -> api.post(ctx, "/api/v1/categories", args(req))));
        tools.add(tool("update_category", "Update a category", """
                {"type":"object","properties":{"categoryId":{"type":"integer","minimum":1},"slug":{"type":"string","minLength":1,"maxLength":120},"name":{"type":"string","minLength":1,"maxLength":200},"parentId":{"type":"integer","minimum":1},"clearParentId":{"type":"boolean"},"active":{"type":"boolean"}},"required":["categoryId"],"additionalProperties":false}
                """, (ctx, req) -> {
            Map<String, Object> a = args(req);
            return api.put(ctx, "/api/v1/categories/" + longArg(a, "categoryId"), withoutKeys(a, "categoryId"));
        }));
        tools.add(tool("delete_category", "Delete a category", """
                {"type":"object","properties":{"categoryId":{"type":"integer","minimum":1}},"required":["categoryId"],"additionalProperties":false}
                """, (ctx, req) -> api.delete(ctx, "/api/v1/categories/" + longArg(args(req), "categoryId"))));

        // Formats
        tools.add(tool("list_formats", "List podcast formats", """
                {"type":"object","properties":{},"additionalProperties":false}
                """, (ctx, req) -> api.get(ctx, "/api/v1/formats", null)));
        tools.add(tool("create_format", "Create a podcast format", """
                {"type":"object","properties":{"slug":{"type":"string","minLength":1,"maxLength":120},"name":{"type":"string","minLength":1,"maxLength":200}},"required":["slug","name"],"additionalProperties":false}
                """, (ctx, req) -> api.post(ctx, "/api/v1/formats", args(req))));
        tools.add(tool("update_format", "Update a podcast format", """
                {"type":"object","properties":{"formatId":{"type":"integer","minimum":1},"slug":{"type":"string","minLength":1,"maxLength":120},"name":{"type":"string","minLength":1,"maxLength":200},"active":{"type":"boolean"}},"required":["formatId"],"additionalProperties":false}
                """, (ctx, req) -> {
            Map<String, Object> a = args(req);
            return api.put(ctx, "/api/v1/formats/" + longArg(a, "formatId"), withoutKeys(a, "formatId"));
        }));
        tools.add(tool("delete_format", "Delete a podcast format", """
                {"type":"object","properties":{"formatId":{"type":"integer","minimum":1}},"required":["formatId"],"additionalProperties":false}
                """, (ctx, req) -> api.delete(ctx, "/api/v1/formats/" + longArg(args(req), "formatId"))));

        // Media
        tools.add(tool("list_media", "List media assets", """
                {"type":"object","properties":{"limit":{"type":"integer","minimum":1,"maximum":100},"offset":{"type":"integer","minimum":0},"folderId":{"type":"integer","minimum":1}},"additionalProperties":false}
                """, (ctx, req) -> api.get(ctx, "/api/v1/media", queryOf(args(req), "limit", "offset", "folderId"))));
        tools.add(tool("get_media", "Get one media asset", """
                {"type":"object","properties":{"assetId":{"type":"integer","minimum":1}},"required":["assetId"],"additionalProperties":false}
                """, (ctx, req) -> api.get(ctx, "/api/v1/media/" + longArg(args(req), "assetId"), null)));
        tools.add(tool("create_media_upload_url", "Request a pre-signed upload URL", """
                {"type":"object","properties":{"filename":{"type":"string","minLength":1,"maxLength":255},"mimeType":{"type":"string","minLength":1,"maxLength":128},"sizeBytes":{"type":"integer","minimum":1},"assetType":{"type":"string","enum":["AUDIO","IMAGE","VIDEO","DOCUMENT"]},"intendedVisibility":{"type":"string","enum":["PUBLIC","PRIVATE"]},"folderId":{"type":"integer","minimum":1}},"required":["filename","mimeType","sizeBytes","assetType"],"additionalProperties":false}
                """, (ctx, req) -> api.post(ctx, "/api/v1/media/upload-url", args(req))));
        tools.add(tool("confirm_media_upload", "Confirm a completed media upload", """
                {"type":"object","properties":{"assetId":{"type":"integer","minimum":1}},"required":["assetId"],"additionalProperties":false}
                """, (ctx, req) -> api.post(ctx, "/api/v1/media/" + longArg(args(req), "assetId") + "/confirm", Map.of())));
        tools.add(tool("rename_media", "Rename a media asset filename", """
                {"type":"object","properties":{"assetId":{"type":"integer","minimum":1},"filename":{"type":"string","minLength":1,"maxLength":255}},"required":["assetId","filename"],"additionalProperties":false}
                """, (ctx, req) -> {
            Map<String, Object> a = args(req);
            return api.put(ctx, "/api/v1/media/" + longArg(a, "assetId"), Map.of("filename", a.get("filename")));
        }));
        tools.add(tool("get_media_preview_url", "Get a short-lived preview URL for a media asset", """
                {"type":"object","properties":{"assetId":{"type":"integer","minimum":1}},"required":["assetId"],"additionalProperties":false}
                """, (ctx, req) -> api.get(ctx, "/api/v1/media/" + longArg(args(req), "assetId") + "/preview-url", null)));
        tools.add(tool("list_media_references", "List content that references a media asset", """
                {"type":"object","properties":{"assetId":{"type":"integer","minimum":1}},"required":["assetId"],"additionalProperties":false}
                """, (ctx, req) -> api.get(ctx, "/api/v1/media/" + longArg(args(req), "assetId") + "/references", null)));
        tools.add(tool("get_media_limits", "Get effective upload limits for the tenant", """
                {"type":"object","properties":{},"additionalProperties":false}
                """, (ctx, req) -> api.get(ctx, "/api/v1/media/limits", null)));
        tools.add(tool("get_media_storage_summary", "Get media storage usage summary for the tenant", """
                {"type":"object","properties":{},"additionalProperties":false}
                """, (ctx, req) -> api.get(ctx, "/api/v1/media/storage-summary", null)));
        tools.add(tool("delete_media", "Delete a media asset", """
                {"type":"object","properties":{"assetId":{"type":"integer","minimum":1}},"required":["assetId"],"additionalProperties":false}
                """, (ctx, req) -> api.delete(ctx, "/api/v1/media/" + longArg(args(req), "assetId"))));
        tools.add(tool("move_media", "Move a media asset into a folder", """
                {"type":"object","properties":{"assetId":{"type":"integer","minimum":1},"folderId":{"type":["integer","null"],"minimum":1}},"required":["assetId"],"additionalProperties":false}
                """, (ctx, req) -> {
            Map<String, Object> a = args(req);
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("folderId", a.containsKey("folderId") ? optionalLong(a, "folderId") : null);
            return api.post(ctx, "/api/v1/media/" + longArg(a, "assetId") + "/move", body);
        }));
        tools.add(tool("list_media_folders", "List media folders", """
                {"type":"object","properties":{},"additionalProperties":false}
                """, (ctx, req) -> api.get(ctx, "/api/v1/media/folders", null)));
        tools.add(tool("create_media_folder", "Create a media folder", """
                {"type":"object","properties":{"name":{"type":"string","minLength":1,"maxLength":200},"parentId":{"type":"integer","minimum":1}},"required":["name"],"additionalProperties":false}
                """, (ctx, req) -> api.post(ctx, "/api/v1/media/folders", args(req))));
        tools.add(tool("update_media_folder", "Rename a media folder", """
                {"type":"object","properties":{"folderId":{"type":"integer","minimum":1},"name":{"type":"string","minLength":1,"maxLength":200}},"required":["folderId","name"],"additionalProperties":false}
                """, (ctx, req) -> {
            Map<String, Object> a = args(req);
            return api.put(ctx, "/api/v1/media/folders/" + longArg(a, "folderId"), Map.of("name", a.get("name")));
        }));
        tools.add(tool("move_media_folder", "Move a media folder under another parent", """
                {"type":"object","properties":{"folderId":{"type":"integer","minimum":1},"parentId":{"type":["integer","null"],"minimum":1}},"required":["folderId"],"additionalProperties":false}
                """, (ctx, req) -> {
            Map<String, Object> a = args(req);
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("parentId", a.containsKey("parentId") ? optionalLong(a, "parentId") : null);
            return api.post(ctx, "/api/v1/media/folders/" + longArg(a, "folderId") + "/move", body);
        }));
        tools.add(tool("delete_media_folder", "Delete a media folder", """
                {"type":"object","properties":{"folderId":{"type":"integer","minimum":1}},"required":["folderId"],"additionalProperties":false}
                """, (ctx, req) -> api.delete(ctx, "/api/v1/media/folders/" + longArg(args(req), "folderId"))));

        return List.copyOf(tools);
    }

    private McpStatelessServerFeatures.SyncToolSpecification tool(
            String name,
            String description,
            String inputSchemaJson,
            BiFunction<io.modelcontextprotocol.common.McpTransportContext, McpSchema.CallToolRequest, McpSchema.CallToolResult> handler
    ) {
        McpSchema.Tool tool = McpSchema.Tool.builder()
                .name(name)
                .description(description)
                .inputSchema(jsonMapper, inputSchemaJson)
                .build();
        return McpStatelessServerFeatures.SyncToolSpecification.builder()
                .tool(tool)
                .callHandler((ctx, req) -> {
                    try {
                        return handler.apply(ctx, req);
                    } catch (RuntimeException ex) {
                        return McpSchema.CallToolResult.builder()
                                .content(List.of(new McpSchema.TextContent(
                                        ex.getMessage() == null ? ex.getClass().getSimpleName() : ex.getMessage()
                                )))
                                .isError(true)
                                .build();
                    }
                })
                .build();
    }
}
