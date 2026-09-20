package de.pnnit.directwerk.modules.email;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import de.pnnit.directwerk.modules.email.entity.EspProvider;
import de.pnnit.directwerk.modules.email.esp.TenantEspConnectionService;
import de.pnnit.directwerk.modules.email.sender.EmailDeliveryException;
import de.pnnit.directwerk.modules.email.sender.EmailSender;
import de.pnnit.directwerk.modules.email.sender.OutboundEmail;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class TransactionalEmailServiceTest {

    private static final UUID JOB_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

    @Mock
    private DirectwerkConfig directwerkConfig;

    @Mock
    private EmailSender emailSender;

    @Mock
    private EmailDeliveryGuard emailDeliveryGuard;

    @Mock
    private de.pnnit.directwerk.modules.email.esp.TenantEspConnectionService tenantEspConnectionService;

    @Mock
    private de.pnnit.directwerk.modules.email.esp.MailgunHttpEmailSender mailgunHttpEmailSender;

    private EmailTemplateRenderer templateRenderer;
    private TransactionalEmailService transactionalEmailService;

    @BeforeEach
    void setUp() {
        templateRenderer = new EmailTemplateRenderer(new ClasspathEmailTemplateSource());
        transactionalEmailService = new TransactionalEmailService(
                directwerkConfig,
                emailSender,
                templateRenderer,
                emailDeliveryGuard,
                tenantEspConnectionService,
                mailgunHttpEmailSender
        );
    }

    @Test
    void sendFromPayloadSkipsDeliveryWhenEmailDisabled() {
        when(directwerkConfig.isEmailEnabled()).thenReturn(false);

        transactionalEmailService.sendFromPayload(
                JOB_ID,
                null,
                "user@example.com",
                EmailTemplate.PASSWORD_RESET,
                Map.of("resetUrl", "http://localhost/reset", "expiresIn", "1 hour")
        );

        verify(emailSender, never()).send(any());
    }

    @Test
    void sendFromPayloadFailsWhenSenderNotReady() {
        when(directwerkConfig.isEmailEnabled()).thenReturn(true);
        when(emailSender.isReady()).thenReturn(false);
        when(emailSender.providerId()).thenReturn("smtp");

        assertThatThrownBy(() -> transactionalEmailService.sendFromPayload(
                JOB_ID,
                null,
                "user@example.com",
                EmailTemplate.PASSWORD_RESET,
                Map.of("resetUrl", "http://localhost/reset", "expiresIn", "1 hour")
        )).isInstanceOf(EmailDeliveryException.class).hasMessageContaining("not ready");

        verify(emailSender, never()).send(any());
    }

    @Test
    void sendFromPayloadSkipsDuplicateDelivery() {
        when(directwerkConfig.isEmailEnabled()).thenReturn(true);
        when(emailSender.isReady()).thenReturn(true);
        when(emailDeliveryGuard.tryClaimDelivery(JOB_ID)).thenReturn(false);

        transactionalEmailService.sendFromPayload(
                JOB_ID,
                null,
                "user@example.com",
                EmailTemplate.PASSWORD_RESET,
                Map.of("resetUrl", "http://localhost/reset", "expiresIn", "1 hour")
        );

        verify(emailSender, never()).send(any());
    }

    @Test
    void sendFromPayloadDelegatesRenderedMessageToSender() {
        when(directwerkConfig.isEmailEnabled()).thenReturn(true);
        when(emailSender.isReady()).thenReturn(true);
        when(emailDeliveryGuard.tryClaimDelivery(JOB_ID)).thenReturn(true);
        when(directwerkConfig.email()).thenReturn(sampleEmailConfig());
        when(emailSender.providerId()).thenReturn("smtp");

        transactionalEmailService.sendFromPayload(
                JOB_ID,
                null,
                "user@example.com",
                EmailTemplate.PASSWORD_RESET,
                Map.of(
                        "resetUrl", "http://localhost:3004/reset-password?token=reset-token",
                        "expiresIn", "1 hour"
                )
        );

        ArgumentCaptor<OutboundEmail> messageCaptor = ArgumentCaptor.forClass(OutboundEmail.class);
        verify(emailSender).send(messageCaptor.capture());
        OutboundEmail sent = messageCaptor.getValue();
        assertThat(sent.to()).isEqualTo("user@example.com");
        assertThat(sent.fromAddress()).isEqualTo("noreply@directwerk.local");
        assertThat(sent.subject()).isEqualTo("Reset your password");
        assertThat(sent.htmlBody()).contains("http://localhost:3004/reset-password?token=reset-token");
        assertThat(sent.template()).isEqualTo("PASSWORD_RESET");
        assertThat(sent.jobId()).isEqualTo(JOB_ID.toString());
    }

    @Test
    void sendFromPayloadReleasesClaimWhenDeliveryFails() {
        when(directwerkConfig.isEmailEnabled()).thenReturn(true);
        when(emailSender.isReady()).thenReturn(true);
        when(emailDeliveryGuard.tryClaimDelivery(JOB_ID)).thenReturn(true);
        when(directwerkConfig.email()).thenReturn(sampleEmailConfig());
        doThrow(new EmailDeliveryException("Email delivery failed", null))
                .when(emailSender)
                .send(any());

        assertThatThrownBy(() -> transactionalEmailService.sendFromPayload(
                JOB_ID,
                null,
                "user@example.com",
                EmailTemplate.PASSWORD_RESET,
                Map.of("resetUrl", "http://localhost/reset", "expiresIn", "1 hour")
        )).isInstanceOf(EmailDeliveryException.class).hasMessageContaining("Email delivery failed");

        verify(emailDeliveryGuard).releaseClaim(JOB_ID);
    }

    @Test
    void sendFromPayloadReleasesClaimOnAnyRuntimeException() {
        when(directwerkConfig.isEmailEnabled()).thenReturn(true);
        when(emailSender.isReady()).thenReturn(true);
        when(emailDeliveryGuard.tryClaimDelivery(JOB_ID)).thenReturn(true);
        when(directwerkConfig.email()).thenReturn(sampleEmailConfig());
        doThrow(new IllegalStateException("render failed"))
                .when(emailSender)
                .send(any());

        assertThatThrownBy(() -> transactionalEmailService.sendFromPayload(
                JOB_ID,
                null,
                "user@example.com",
                EmailTemplate.PASSWORD_RESET,
                Map.of("resetUrl", "http://localhost/reset", "expiresIn", "1 hour")
        )).isInstanceOf(IllegalStateException.class).hasMessageContaining("render failed");

        verify(emailDeliveryGuard).releaseClaim(JOB_ID);
    }

    @Test
    void sendFromPayloadUsesTenantMailgunCredentialsAndProvider() {
        when(directwerkConfig.isEmailEnabled()).thenReturn(true);
        when(emailDeliveryGuard.tryClaimDelivery(JOB_ID)).thenReturn(true);
        TenantEspConnectionService.ResolvedEspCredentials credentials =
                new TenantEspConnectionService.ResolvedEspCredentials(
                        EspProvider.MAILGUN,
                        "tenant.example.com",
                        "noreply@tenant.example.com",
                        "Tenant Sender",
                        "EU",
                        "api-key"
                );
        when(tenantEspConnectionService.resolveActiveMailgun(5L)).thenReturn(Optional.of(credentials));

        transactionalEmailService.sendFromPayload(
                JOB_ID,
                5L,
                "user@example.com",
                EmailTemplate.PASSWORD_RESET,
                Map.of("resetUrl", "http://localhost/reset", "expiresIn", "1 hour")
        );

        ArgumentCaptor<OutboundEmail> messageCaptor = ArgumentCaptor.forClass(OutboundEmail.class);
        verify(mailgunHttpEmailSender).send(eq(credentials), messageCaptor.capture());
        OutboundEmail sent = messageCaptor.getValue();
        assertThat(sent.to()).isEqualTo("user@example.com");
        assertThat(sent.fromAddress()).isEqualTo("noreply@tenant.example.com");
        assertThat(sent.fromName()).isEqualTo("Tenant Sender");
        assertThat(sent.subject()).isEqualTo("Reset your password");
        verify(emailSender, never()).send(any());
        verify(emailSender, never()).isReady();
    }

    @Test
    void sendFromPayloadReleasesClaimWhenTenantMailgunFails() {
        when(directwerkConfig.isEmailEnabled()).thenReturn(true);
        when(directwerkConfig.email()).thenReturn(sampleEmailConfig());
        when(emailDeliveryGuard.tryClaimDelivery(JOB_ID)).thenReturn(true);
        TenantEspConnectionService.ResolvedEspCredentials credentials =
                new TenantEspConnectionService.ResolvedEspCredentials(
                        EspProvider.MAILGUN,
                        "tenant.example.com",
                        "noreply@tenant.example.com",
                        null,
                        "EU",
                        "api-key"
                );
        when(tenantEspConnectionService.resolveActiveMailgun(5L)).thenReturn(Optional.of(credentials));
        doThrow(new EmailDeliveryException("Mailgun send failed", null))
                .when(mailgunHttpEmailSender)
                .send(eq(credentials), any());

        assertThatThrownBy(() -> transactionalEmailService.sendFromPayload(
                JOB_ID,
                5L,
                "user@example.com",
                EmailTemplate.PASSWORD_RESET,
                Map.of("resetUrl", "http://localhost/reset", "expiresIn", "1 hour")
        )).isInstanceOf(EmailDeliveryException.class).hasMessageContaining("Mailgun send failed");

        verify(emailDeliveryGuard).releaseClaim(JOB_ID);
        verify(emailSender, never()).send(any());
    }

    private static DirectwerkProperties.Email sampleEmailConfig() {
        return new DirectwerkProperties.Email(
                "smtp",
                "noreply@directwerk.local",
                "Directwerk",
                "http://localhost:3004",
                "http://localhost:3001",
                "/accept-invite",
                "/reset-password",
                "/verify-email",
                7L
        );
    }
}
