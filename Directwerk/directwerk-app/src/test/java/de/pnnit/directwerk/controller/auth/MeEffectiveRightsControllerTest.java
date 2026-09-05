package de.pnnit.directwerk.controller.auth;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import de.pnnit.directwerk.modules.core.authorization.ContentEntityType;
import de.pnnit.directwerk.modules.core.authorization.ContentOperation;
import de.pnnit.directwerk.modules.core.authorization.EffectiveAccess;
import de.pnnit.directwerk.modules.core.service.MembershipPermissionService;
import de.pnnit.directwerk.multitenancy.TenantContext;
import de.pnnit.directwerk.security.DirectwerkUserPrincipal;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
class MeEffectiveRightsControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private MembershipPermissionService membershipPermissionService;

    @BeforeEach
    void setUpTenantContext() {
        TenantContext.setTenantId(10L);
        DirectwerkUserPrincipal principal = new DirectwerkUserPrincipal(
                5L,
                "editor@example.com",
                "hash",
                10L,
                List.of(new SimpleGrantedAuthority("ROLE_EDITOR")));
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));
    }

    @AfterEach
    void clearContext() {
        TenantContext.clear();
        SecurityContextHolder.clearContext();
    }

    @Test
    void myEffectiveRightsResolveForAuthenticatedMember() throws Exception {
        Map<ContentEntityType, Map<ContentOperation, EffectiveAccess>> effective =
                new EnumMap<>(ContentEntityType.class);
        Map<ContentOperation, EffectiveAccess> episode = new EnumMap<>(ContentOperation.class);
        episode.put(ContentOperation.DELETE, EffectiveAccess.OWN_ONLY);
        effective.put(ContentEntityType.EPISODE, episode);
        when(membershipPermissionService.effectiveRightsForMember(10L, 5L)).thenReturn(
                new MembershipPermissionService.MemberRights(
                        5L, List.of("EDITOR"), List.of(), effective));

        mockMvc.perform(get("/api/v1/me/effective-rights"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.userId").value(5))
                .andExpect(jsonPath("$.data.effective.EPISODE.DELETE").value("OWN_ONLY"));

        verify(membershipPermissionService).effectiveRightsForMember(10L, 5L);
    }
}
