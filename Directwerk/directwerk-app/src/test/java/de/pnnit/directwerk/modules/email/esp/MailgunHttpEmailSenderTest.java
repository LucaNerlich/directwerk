package de.pnnit.directwerk.modules.email.esp;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

import de.pnnit.directwerk.modules.email.entity.EspProvider;
import de.pnnit.directwerk.modules.email.sender.EmailDeliveryException;
import de.pnnit.directwerk.modules.email.sender.OutboundEmail;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

class MailgunHttpEmailSenderTest {

    private static final TenantEspConnectionService.ResolvedEspCredentials CREDENTIALS =
            new TenantEspConnectionService.ResolvedEspCredentials(
                    EspProvider.MAILGUN,
                    "tenant.example.com",
                    "noreply@tenant.example.com",
                    "Tenant Sender",
                    "EU",
                    "api-key"
            );

    private MailgunHttpEmailSender sender;

    @BeforeEach
    void setUp() {
        sender = new MailgunHttpEmailSender(RestClient.builder());
    }

    @Test
    void rejectsLineBreaksInRecipient() {
        assertThatThrownBy(() -> sender.send(CREDENTIALS, email(
                "victim@example.com\r\nBcc: attacker@example.com",
                "noreply@tenant.example.com",
                "Tenant Sender",
                "Subject",
                Map.of()
        ))).isInstanceOf(EmailDeliveryException.class);
    }

    @Test
    void rejectsLineBreaksInFromName() {
        assertThatThrownBy(() -> sender.send(CREDENTIALS, email(
                "user@example.com",
                "noreply@tenant.example.com",
                "Evil\r\nBcc: attacker@example.com",
                "Subject",
                Map.of()
        ))).isInstanceOf(EmailDeliveryException.class);
    }

    @Test
    void rejectsLineBreaksInSubjectAndHeaders() {
        assertThatThrownBy(() -> sender.send(CREDENTIALS, email(
                "user@example.com",
                "noreply@tenant.example.com",
                "Tenant Sender",
                "Hello\r\nX-Injected: yes",
                Map.of()
        ))).isInstanceOf(EmailDeliveryException.class);

        assertThatThrownBy(() -> sender.send(CREDENTIALS, email(
                "user@example.com",
                "noreply@tenant.example.com",
                "Tenant Sender",
                "Subject",
                Map.of("Reply-To", "user@example.com\r\nBcc: attacker@example.com")
        ))).isInstanceOf(EmailDeliveryException.class);
    }

    @Test
    void rejectsMalformedAddresses() {
        assertThatThrownBy(() -> sender.send(CREDENTIALS, email(
                "not-an-address",
                "noreply@tenant.example.com",
                "Tenant Sender",
                "Subject",
                Map.of()
        ))).isInstanceOf(EmailDeliveryException.class);
    }

    @Test
    void rejectsDomainWithPathMetacharacters() {
        TenantEspConnectionService.ResolvedEspCredentials badDomain =
                new TenantEspConnectionService.ResolvedEspCredentials(
                        EspProvider.MAILGUN,
                        "tenant.example.com/evil?x=1",
                        "noreply@tenant.example.com",
                        "Tenant Sender",
                        "EU",
                        "api-key"
                );

        assertThatThrownBy(() -> sender.send(badDomain, email(
                "user@example.com",
                "noreply@tenant.example.com",
                "Tenant Sender",
                "Subject",
                Map.of()
        ))).isInstanceOf(EmailDeliveryException.class);
    }

    private static OutboundEmail email(
            String to,
            String fromAddress,
            String fromName,
            String subject,
            Map<String, String> headers
    ) {
        return new OutboundEmail(
                to,
                fromAddress,
                fromName,
                subject,
                "<p>body</p>",
                "body",
                "job-1",
                "PASSWORD_RESET",
                headers
        );
    }
}
