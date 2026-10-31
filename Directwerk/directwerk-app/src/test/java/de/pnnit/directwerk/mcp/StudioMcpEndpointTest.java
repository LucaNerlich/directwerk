package de.pnnit.directwerk.mcp;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import de.pnnit.directwerk.multitenancy.TenantContext;
import de.pnnit.directwerk.security.DirectwerkUserPrincipal;
import de.pnnit.directwerk.security.RoleConstants;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
class StudioMcpEndpointTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private StudioMcpTools studioMcpTools;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId(10L);
        DirectwerkUserPrincipal principal = new DirectwerkUserPrincipal(
                5L, "editor@example.com", null, 10L,
                List.of(new SimpleGrantedAuthority(RoleConstants.EDITOR))
        );
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, "n/a", principal.getAuthorities())
        );
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        TenantContext.clear();
    }

    @Test
    void toolCatalogMirrorsStudioContentSurface() {
        Set<String> names = studioMcpTools.specifications().stream()
                .map(spec -> spec.tool().name())
                .collect(java.util.stream.Collectors.toSet());
        assertThat(names).contains(
                "list_articles",
                "create_episode",
                "list_series",
                "list_categories",
                "list_formats",
                "list_media",
                "create_media_upload_url",
                "archive_article",
                "unarchive_article",
                "cancel_schedule_article",
                "bulk_publish_articles",
                "bulk_unpublish_articles",
                "bulk_delete_articles",
                "notify_article",
                "notify_preview_article",
                "set_article_newsletter_lists",
                "archive_episode",
                "unarchive_episode",
                "cancel_schedule_episode",
                "bulk_publish_episodes",
                "bulk_unpublish_episodes",
                "bulk_delete_episodes",
                "notify_episode",
                "notify_preview_episode",
                "set_episode_enclosure_enabled",
                "rename_media",
                "get_media_preview_url",
                "list_media_references",
                "get_media_limits",
                "get_media_storage_summary"
        );
        assertThat(names).doesNotContain("import_podcast_manifest");
        assertThat(names.size()).isGreaterThanOrEqualTo(63);
    }

    @Test
    void initializeAndListToolsOverHttp() throws Exception {
        MvcResult init = mockMvc.perform(post("/mcp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .accept(MediaType.APPLICATION_JSON, MediaType.valueOf("text/event-stream"))
                        .header("Authorization", "Bearer dwk_test_secret")
                        .header("X-Tenant-Host", "tenant.example.com")
                        .content("""
                                {"jsonrpc":"2.0","id":1,"method":"initialize","params":{
                                  "protocolVersion":"2025-03-26",
                                  "capabilities":{},
                                  "clientInfo":{"name":"test","version":"0.0.1"}
                                }}
                                """))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode initBody = objectMapper.readTree(init.getResponse().getContentAsString());
        assertThat(initBody.path("result").path("serverInfo").path("name").asString())
                .isEqualTo("directwerk-studio");
        assertThat(initBody.path("result").path("capabilities").path("tools").isObject()).isTrue();

        MvcResult tools = mockMvc.perform(post("/mcp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .accept(MediaType.APPLICATION_JSON, MediaType.valueOf("text/event-stream"))
                        .header("Authorization", "Bearer dwk_test_secret")
                        .header("X-Tenant-Host", "tenant.example.com")
                        .content("""
                                {"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}
                                """))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode toolsBody = objectMapper.readTree(tools.getResponse().getContentAsString());
        assertThat(toolsBody.path("result").path("tools").isArray()).isTrue();
        assertThat(toolsBody.path("result").path("tools").size()).isGreaterThanOrEqualTo(63);
    }
}
