package de.pnnit.directwerk.modules.email.esp;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.core.util.EnvelopeTokenProtector;
import de.pnnit.directwerk.modules.email.entity.EspConnectionStatus;
import de.pnnit.directwerk.modules.email.entity.EspProvider;
import de.pnnit.directwerk.modules.email.entity.TenantEspConnection;
import de.pnnit.directwerk.modules.email.repository.TenantEspConnectionRepository;
import java.time.Instant;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class TenantEspConnectionServiceTest {

    private static final Long TENANT_ID = 10L;

    @Mock
    private TenantEspConnectionRepository tenantEspConnectionRepository;
    @Mock
    private TenantRepository tenantRepository;
    @Mock
    private EnvelopeTokenProtector envelopeTokenProtector;

    private TenantEspConnectionService service;

    @BeforeEach
    void setUp() {
        service = new TenantEspConnectionService(
                tenantEspConnectionRepository,
                tenantRepository,
                envelopeTokenProtector
        );
    }

    @Test
    void rejectsDomainWithWhitespaceOrPathMetacharacters() {
        assertThatThrownBy(() -> service.upsertMailgun(
                TENANT_ID, "tenant example.com", "noreply@tenant.example.com", null, "EU", "key"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.upsertMailgun(
                TENANT_ID, "tenant.example.com/evil?x=1", "noreply@tenant.example.com", null, "EU", "key"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.upsertMailgun(
                TENANT_ID, "tenant.example.com#frag", "noreply@tenant.example.com", null, "EU", "key"))
                .isInstanceOf(IllegalArgumentException.class);

        verify(tenantEspConnectionRepository, never()).save(any());
    }

    @Test
    void rejectsFromNameWithLineBreaks() {
        assertThatThrownBy(() -> service.upsertMailgun(
                TENANT_ID,
                "tenant.example.com",
                "noreply@tenant.example.com",
                "Evil\r\nBcc: attacker@example.com",
                "EU",
                "key"
        )).isInstanceOf(IllegalArgumentException.class);

        verify(tenantEspConnectionRepository, never()).save(any());
    }

    @Test
    void trimsAndPersistsValidFromName() {
        when(tenantEspConnectionRepository.findByTenant_Id(TENANT_ID)).thenReturn(Optional.empty());
        when(envelopeTokenProtector.protect("key")).thenReturn("ciphertext");
        when(tenantEspConnectionRepository.save(any(TenantEspConnection.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        TenantEspConnection saved = service.upsertMailgun(
                TENANT_ID, "tenant.example.com", "Noreply@Tenant.Example.com", "  Tenant Sender  ", "eu", "key");

        assertThat(saved.getDomain()).isEqualTo("tenant.example.com");
        assertThat(saved.getFromEmail()).isEqualTo("noreply@tenant.example.com");
        assertThat(saved.getFromName()).isEqualTo("Tenant Sender");
        assertThat(saved.getRegion()).isEqualTo("EU");
    }

    @Test
    void hasActiveMailgunDoesNotRevealKey() {
        TenantEspConnection connection = connectedMailgun("enc:v1:ciphertext");
        when(tenantEspConnectionRepository.findByTenant_Id(TENANT_ID)).thenReturn(Optional.of(connection));

        assertThat(service.hasActiveMailgun(TENANT_ID)).isTrue();
        verify(envelopeTokenProtector, never()).reveal(any());
    }

    @Test
    void toViewNeverExposesKeyOrCiphertext() {
        TenantEspConnectionService.EspConnectionView view = TenantEspConnectionService.toView(
                connectedMailgun("enc:v1:secret-cipher")
        );

        assertThat(view.apiKeyConfigured()).isTrue();
        assertThat(view.toString()).doesNotContain("secret-cipher");
        assertThat(view.toString()).doesNotContain("apiKey=");
    }

    @Test
    void resolvedCredentialsToStringRedactsApiKey() {
        TenantEspConnectionService.ResolvedEspCredentials credentials =
                new TenantEspConnectionService.ResolvedEspCredentials(
                        EspProvider.MAILGUN,
                        "tenant.example.com",
                        "noreply@tenant.example.com",
                        "Sender",
                        "EU",
                        "key-super-secret-do-not-log"
                );

        assertThat(credentials.toString()).doesNotContain("key-super-secret-do-not-log");
        assertThat(credentials.toString()).contains("apiKey=***");
        assertThat(credentials.apiKey()).isEqualTo("key-super-secret-do-not-log");
    }

    private static TenantEspConnection connectedMailgun(String ciphertext) {
        TenantEspConnection connection = new TenantEspConnection();
        connection.setProvider(EspProvider.MAILGUN);
        connection.setDomain("tenant.example.com");
        connection.setFromEmail("noreply@tenant.example.com");
        connection.setFromName("Sender");
        connection.setRegion("EU");
        connection.setApiKeyCiphertext(ciphertext);
        connection.setStatus(EspConnectionStatus.CONNECTED);
        connection.setConnectedAt(Instant.parse("2026-01-01T00:00:00Z"));
        return connection;
    }
}
