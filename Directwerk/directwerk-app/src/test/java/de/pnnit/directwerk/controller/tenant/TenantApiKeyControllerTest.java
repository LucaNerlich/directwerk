package de.pnnit.directwerk.controller.tenant;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import de.pnnit.directwerk.modules.core.apikey.TenantApiKeyScopes;
import de.pnnit.directwerk.modules.core.entity.TenantApiKey;
import de.pnnit.directwerk.modules.core.service.TenantApiKeyService;
import de.pnnit.directwerk.multitenancy.TenantContext;
import de.pnnit.directwerk.security.DirectwerkUserPrincipal;
import de.pnnit.directwerk.security.RoleConstants;
import java.time.Instant;
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
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
class TenantApiKeyControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private TenantApiKeyService tenantApiKeyService;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId(10L);
        authenticate(RoleConstants.TENANT_ADMIN);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
        SecurityContextHolder.clearContext();
    }

    @Test
    void listReturnsActiveKeysForTenantAdmin() throws Exception {
        TenantApiKey key = sampleKey();
        when(tenantApiKeyService.listActive(10L)).thenReturn(List.of(key));

        mockMvc.perform(get("/api/v1/tenant/api-keys"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].id").value(7))
                .andExpect(jsonPath("$.data[0].name").value("Cursor MCP"))
                .andExpect(jsonPath("$.data[0].prefix").value("abcd1234"))
                .andExpect(jsonPath("$.data[0].scopes[0]").value("content:write"))
                .andExpect(jsonPath("$.data[0].secret").doesNotExist());
    }

    @Test
    void createReturnsSecretOnce() throws Exception {
        TenantApiKey key = sampleKey();
        when(tenantApiKeyService.create(eq(10L), eq(5L), eq("Cursor MCP"), any()))
                .thenReturn(new TenantApiKeyService.IssuedApiKey(key, "dwk_abcd1234_secretvalue"));

        mockMvc.perform(post("/api/v1/tenant/api-keys")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Cursor MCP","scopes":["content:write"]}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.id").value(7))
                .andExpect(jsonPath("$.data.secret").value("dwk_abcd1234_secretvalue"));
    }

    @Test
    void revokeCallsService() throws Exception {
        TenantApiKey key = sampleKey();
        key.setRevokedAt(Instant.parse("2026-10-30T12:00:00Z"));
        when(tenantApiKeyService.revoke(10L, 7L)).thenReturn(key);

        mockMvc.perform(delete("/api/v1/tenant/api-keys/7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.revokedAt").exists());

        verify(tenantApiKeyService).revoke(10L, 7L);
    }

    @Test
    void editorForbidden() throws Exception {
        authenticate(RoleConstants.EDITOR);

        mockMvc.perform(get("/api/v1/tenant/api-keys"))
                .andExpect(status().isForbidden());
    }

    private static void authenticate(String roleAuthority) {
        DirectwerkUserPrincipal principal = new DirectwerkUserPrincipal(
                5L,
                "admin@example.com",
                null,
                10L,
                List.of(new SimpleGrantedAuthority(roleAuthority))
        );
        SecurityContextHolder.getContext().setAuthentication(
                UsernamePasswordAuthenticationToken.authenticated(principal, null, principal.getAuthorities())
        );
    }

    private static TenantApiKey sampleKey() {
        TenantApiKey key = new TenantApiKey();
        key.setId(7L);
        key.setName("Cursor MCP");
        key.setPrefix("abcd1234");
        key.setScopes(Set.of(TenantApiKeyScopes.CONTENT_WRITE));
        key.setCreatedAt(Instant.parse("2026-10-30T11:00:00Z"));
        return key;
    }
}
