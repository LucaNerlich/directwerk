package de.pnnit.directwerk.controller.platform;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import de.pnnit.directwerk.modules.core.service.PlatformAuditQueryService;
import de.pnnit.directwerk.modules.core.service.PlatformAuditQueryService.PlatformAuditView;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

@ExtendWith(MockitoExtension.class)
class PlatformAuditControllerTest {

    @Mock
    private PlatformAuditQueryService platformAuditQueryService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new PlatformAuditController(platformAuditQueryService))
                .build();
    }

    @Test
    void listRecentReturnsAuditEvents() throws Exception {
        when(platformAuditQueryService.listRecent(20)).thenReturn(List.of(
                new PlatformAuditView(
                        1L,
                        "TENANT_CREATED",
                        9L,
                        3L,
                        Map.of("slug", "alpha-show-c"),
                        Instant.parse("2026-07-19T12:00:00Z")
                )
        ));

        mockMvc.perform(get("/api/v1/platform/audit").param("limit", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].action").value("TENANT_CREATED"))
                .andExpect(jsonPath("$.data[0].tenantId").value(3));

        verify(platformAuditQueryService).listRecent(20);
    }
}
