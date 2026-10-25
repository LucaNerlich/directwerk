package de.pnnit.directwerk.controller.tenant;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import de.pnnit.directwerk.modules.email.esp.MailgunNotConfiguredException;
import de.pnnit.directwerk.modules.email.esp.MailgunTestEmailService;
import de.pnnit.directwerk.modules.email.esp.NoTenantAdminsException;
import de.pnnit.directwerk.multitenancy.TenantContext;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
class TenantIntegrationsControllerMailgunTestTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private MailgunTestEmailService mailgunTestEmailService;

    @BeforeEach
    void setUpTenantContext() {
        TenantContext.setTenantId(10L);
    }

    @AfterEach
    void clearTenantContext() {
        TenantContext.clear();
    }

    @Test
    @WithMockUser(roles = "TENANT_ADMIN")
    void sendMailgunTestReturnsResultForTenantAdmin() throws Exception {
        when(mailgunTestEmailService.sendTestToTenantAdmins(10L)).thenReturn(
                new MailgunTestEmailService.MailgunTestSendResult(
                        1,
                        0,
                        List.of(new MailgunTestEmailService.RecipientResult(
                                "admin@example.com", "QUEUED", null))
                )
        );

        mockMvc.perform(post("/api/v1/tenant/integrations/esp/mailgun/test"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.queuedCount").value(1))
                .andExpect(jsonPath("$.data.failedCount").value(0))
                .andExpect(jsonPath("$.data.results[0].email").value("admin@example.com"))
                .andExpect(jsonPath("$.data.results[0].status").value("QUEUED"));

        verify(mailgunTestEmailService).sendTestToTenantAdmins(10L);
    }

    @Test
    @WithMockUser(roles = "TENANT_ADMIN")
    void sendMailgunTestMapsMissingConfigToStructuredError() throws Exception {
        when(mailgunTestEmailService.sendTestToTenantAdmins(10L))
                .thenThrow(new MailgunNotConfiguredException("Mailgun is not connected for this tenant"));

        mockMvc.perform(post("/api/v1/tenant/integrations/esp/mailgun/test"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].code").value("MAILGUN_NOT_CONFIGURED"));
    }

    @Test
    @WithMockUser(roles = "TENANT_ADMIN")
    void sendMailgunTestMapsEmptyAdminsToStructuredError() throws Exception {
        when(mailgunTestEmailService.sendTestToTenantAdmins(10L))
                .thenThrow(new NoTenantAdminsException("No active tenant admins with email addresses found"));

        mockMvc.perform(post("/api/v1/tenant/integrations/esp/mailgun/test"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].code").value("NO_TENANT_ADMINS"));
    }

    @Test
    @WithMockUser(roles = "EDITOR")
    void sendMailgunTestForbiddenForEditor() throws Exception {
        mockMvc.perform(post("/api/v1/tenant/integrations/esp/mailgun/test"))
                .andExpect(status().isForbidden());

        verifyNoInteractions(mailgunTestEmailService);
    }
}
