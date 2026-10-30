package de.pnnit.directwerk.controller.tenant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import de.pnnit.directwerk.api.exception.GlobalExceptionHandler;
import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import de.pnnit.directwerk.modules.email.content.TenantContentEmailTemplateService;
import de.pnnit.directwerk.modules.email.entity.EspConnectionStatus;
import de.pnnit.directwerk.modules.email.entity.EspProvider;
import de.pnnit.directwerk.modules.email.entity.TenantEspConnection;
import de.pnnit.directwerk.modules.email.esp.MailgunTestEmailService;
import de.pnnit.directwerk.modules.email.esp.TenantEspConnectionService;
import de.pnnit.directwerk.modules.stripebilling.StripeConnectService;
import de.pnnit.directwerk.multitenancy.TenantContext;
import java.time.Instant;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/**
 * Contract: Mailgun API key material must never appear in GET/status/PUT JSON responses.
 */
class TenantIntegrationsControllerEspKeyLeakTest {

    private static final String SECRET_KEY = "key-must-never-appear-in-responses";
    private static final String CIPHERTEXT = "enc:v1:must-never-appear-either";

    private MockMvc mockMvc;
    private TenantEspConnectionService tenantEspConnectionService;
    private ModuleGateService moduleGateService;
    private DirectwerkConfig directwerkConfig;
    private TenantContentEmailTemplateService tenantContentEmailTemplateService;
    private StripeConnectService stripeConnectService;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId(10L);
        tenantEspConnectionService = mock(TenantEspConnectionService.class);
        moduleGateService = mock(ModuleGateService.class);
        directwerkConfig = mock(DirectwerkConfig.class);
        tenantContentEmailTemplateService = mock(TenantContentEmailTemplateService.class);
        stripeConnectService = mock(StripeConnectService.class);
        MailgunTestEmailService mailgunTestEmailService = mock(MailgunTestEmailService.class);

        when(moduleGateService.isModuleActive(eq(10L), any())).thenReturn(true);
        when(tenantContentEmailTemplateService.countForTenant(10L)).thenReturn(0L);
        when(directwerkConfig.isEmailEnabled()).thenReturn(true);
        when(directwerkConfig.email()).thenReturn(new DirectwerkProperties.Email(
                "smtp",
                "noreply@platform.example.com",
                "Directwerk",
                "https://studio.example.com",
                "https://admin.example.com",
                "/accept-invite",
                "/reset-password",
                "/verify-email",
                7
        ));
        when(stripeConnectService.status(10L)).thenReturn(
                new StripeConnectService.StripeStatusSnapshot(
                        "NOT_CONNECTED", false, null, false, false, false)
        );

        TenantIntegrationsController controller = new TenantIntegrationsController(
                moduleGateService,
                directwerkConfig,
                tenantEspConnectionService,
                mailgunTestEmailService,
                tenantContentEmailTemplateService,
                stripeConnectService
        );
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @AfterEach
    void clearTenantContext() {
        TenantContext.clear();
    }

    @Test
    void getEspNeverReturnsApiKeyOrCiphertext() throws Exception {
        when(tenantEspConnectionService.find(10L)).thenReturn(Optional.of(connectedRow()));

        MvcResult result = mockMvc.perform(get("/api/v1/tenant/integrations/esp"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.apiKeyConfigured").value(true))
                .andExpect(jsonPath("$.data.apiKey").doesNotExist())
                .andExpect(jsonPath("$.data.apiKeyCiphertext").doesNotExist())
                .andReturn();

        assertBodyHasNoSecret(result.getResponse().getContentAsString());
    }

    @Test
    void statusNeverReturnsApiKeyOrCiphertext() throws Exception {
        when(tenantEspConnectionService.find(10L)).thenReturn(Optional.of(connectedRow()));

        MvcResult result = mockMvc.perform(get("/api/v1/tenant/integrations/status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.emailNotify.mailgun.apiKeyConfigured").value(true))
                .andExpect(jsonPath("$.data.emailNotify.mailgun.apiKey").doesNotExist())
                .andReturn();

        assertBodyHasNoSecret(result.getResponse().getContentAsString());
    }

    @Test
    void connectMailgunPutResponseOmitsKey() throws Exception {
        when(tenantEspConnectionService.upsertMailgun(
                eq(10L), any(), any(), any(), any(), eq(SECRET_KEY)
        )).thenReturn(connectedRow());

        MvcResult result = mockMvc.perform(put("/api/v1/tenant/integrations/esp/mailgun")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "domain": "tenant.example.com",
                                  "fromEmail": "noreply@tenant.example.com",
                                  "fromName": "Sender",
                                  "region": "EU",
                                  "apiKey": "%s"
                                }
                                """.formatted(SECRET_KEY)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.apiKeyConfigured").value(true))
                .andExpect(jsonPath("$.data.apiKey").doesNotExist())
                .andReturn();

        assertBodyHasNoSecret(result.getResponse().getContentAsString());
        assertThat(new TenantIntegrationsController.ConnectMailgunRequest(
                "tenant.example.com",
                "noreply@tenant.example.com",
                "Sender",
                "EU",
                SECRET_KEY
        ).toString()).doesNotContain(SECRET_KEY).contains("apiKey=***");
    }

    private static TenantEspConnection connectedRow() {
        TenantEspConnection connection = new TenantEspConnection();
        connection.setProvider(EspProvider.MAILGUN);
        connection.setDomain("tenant.example.com");
        connection.setFromEmail("noreply@tenant.example.com");
        connection.setFromName("Sender");
        connection.setRegion("EU");
        connection.setApiKeyCiphertext(CIPHERTEXT);
        connection.setStatus(EspConnectionStatus.CONNECTED);
        connection.setConnectedAt(Instant.parse("2026-01-01T00:00:00Z"));
        return connection;
    }

    private static void assertBodyHasNoSecret(String body) {
        assertThat(body).doesNotContain(SECRET_KEY);
        assertThat(body).doesNotContain(CIPHERTEXT);
        assertThat(body).doesNotContain("\"apiKey\"");
        assertThat(body).doesNotContain("apiKeyCiphertext");
    }
}
