package de.pnnit.directwerk.modules.email;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.queue.JobStatus;
import de.pnnit.directwerk.modules.queue.QueueJob;
import de.pnnit.directwerk.modules.queue.QueueNames;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

@ExtendWith(MockitoExtension.class)
class EmailJobHandlerTest {

    @Mock
    private TransactionalEmailService transactionalEmailService;

    @Mock
    private EmailTokenProtector emailTokenProtector;

    @Mock
    private EmailLinkBuilder linkBuilder;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private EmailJobHandler handler;

    @BeforeEach
    void setUp() {
        handler = new EmailJobHandler(transactionalEmailService, objectMapper, emailTokenProtector, linkBuilder);
    }

    @Test
    void handlesTenantInvitation() {
        when(emailTokenProtector.revealFromQueue("encrypted-invite")).thenReturn("raw-invite");
        when(linkBuilder.buildTokenUrl(EmailTemplate.TENANT_INVITATION, "raw-invite", null))
                .thenReturn("http://localhost:3004/accept-invite?token=raw-invite");

        handler.handle(job("TENANT_INVITATION", node -> {
            node.put("to", "a@example.com");
            node.putObject("variables")
                    .put("recipientName", "Ada")
                    .put("tenantName", "Acme")
                    .put("role", "EDITOR")
                    .put("expiresIn", "24 hours");
            node.put("token", "encrypted-invite");
        }));

        verify(transactionalEmailService).sendFromPayload(
                org.mockito.ArgumentMatchers.any(UUID.class),
                org.mockito.ArgumentMatchers.isNull(),
                org.mockito.ArgumentMatchers.eq("a@example.com"),
                org.mockito.ArgumentMatchers.eq(EmailTemplate.TENANT_INVITATION),
                org.mockito.ArgumentMatchers.argThat(variables ->
                        "Ada".equals(variables.get("recipientName"))
                                && variables.get("acceptInviteUrl").contains("raw-invite")
                )
        );
    }

    @Test
    void clampsAnOversizedDisplayVariableInsteadOfFailingTheSend() {
        // #540: the write side accepts names up to 255 chars while the email module capped them at
        // 200, so a legitimately stored value turned every send into a permanently failing job.
        String longName = "A".repeat(201);
        when(emailTokenProtector.revealFromQueue("encrypted-invite")).thenReturn("raw-invite");
        when(linkBuilder.buildTokenUrl(EmailTemplate.TENANT_INVITATION, "raw-invite", null))
                .thenReturn("http://localhost:3004/accept-invite?token=raw-invite");

        handler.handle(job("TENANT_INVITATION", node -> {
            node.put("to", "a@example.com");
            node.putObject("variables")
                    .put("recipientName", longName)
                    .put("tenantName", "Acme")
                    .put("role", "EDITOR")
                    .put("expiresIn", "24 hours");
            node.put("token", "encrypted-invite");
        }));

        verify(transactionalEmailService).sendFromPayload(
                org.mockito.ArgumentMatchers.any(UUID.class),
                org.mockito.ArgumentMatchers.isNull(),
                org.mockito.ArgumentMatchers.eq("a@example.com"),
                org.mockito.ArgumentMatchers.eq(EmailTemplate.TENANT_INVITATION),
                org.mockito.ArgumentMatchers.argThat(variables ->
                        variables.get("recipientName").length() == 200
                )
        );
    }

    @Test
    void stillFailsClosedForAnOversizedMachineGeneratedVariable() {
        // A truncated signed URL would send a broken link, so machine-generated values keep failing.
        assertThatThrownBy(() -> handler.handle(job("CONTENT_EPISODE_PUBLISHED", node -> {
            node.put("to", "a@example.com");
            node.putObject("variables")
                    .put("recipientName", "Ada")
                    .put("tenantName", "Acme")
                    .put("siteTitle", "Acme Podcast")
                    .put("title", "Episode 1")
                    .put("excerpt", "Kurz")
                    .put("contentUrl", "https://example.test/episodes/1?token=" + "x".repeat(3000))
                    .put("preferencesUrl", "https://example.test/preferences")
                    .put("primaryColor", "#123456");
        })))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("contentUrl");

        verifyNoInteractions(transactionalEmailService);
    }

    @Test
    void handlesPasswordReset() {
        when(emailTokenProtector.revealFromQueue("encrypted-reset")).thenReturn("raw-reset");
        when(linkBuilder.buildTokenUrl(EmailTemplate.PASSWORD_RESET, "raw-reset", null))
                .thenReturn("http://localhost:3004/reset-password?token=raw-reset");

        handler.handle(job("PASSWORD_RESET", node -> {
            node.put("to", "a@example.com");
            node.putObject("variables").put("expiresIn", "1 hour");
            node.put("token", "encrypted-reset");
        }));

        verify(transactionalEmailService).sendFromPayload(
                org.mockito.ArgumentMatchers.any(UUID.class),
                org.mockito.ArgumentMatchers.isNull(),
                org.mockito.ArgumentMatchers.eq("a@example.com"),
                org.mockito.ArgumentMatchers.eq(EmailTemplate.PASSWORD_RESET),
                org.mockito.ArgumentMatchers.argThat(variables -> variables.get("resetUrl").contains("raw-reset"))
        );
    }

    @Test
    void handlesEmailVerification() {
        when(emailTokenProtector.revealFromQueue("encrypted-verify")).thenReturn("raw-verify");
        when(linkBuilder.buildTokenUrl(EmailTemplate.EMAIL_VERIFICATION, "raw-verify", null))
                .thenReturn("http://localhost:3004/verify-email?token=raw-verify");

        handler.handle(job("EMAIL_VERIFICATION", node -> {
            node.put("to", "a@example.com");
            node.putObject("variables")
                    .put("recipientName", "Ada")
                    .put("expiresIn", "24 hours");
            node.put("token", "encrypted-verify");
        }));

        verify(transactionalEmailService).sendFromPayload(
                org.mockito.ArgumentMatchers.any(UUID.class),
                org.mockito.ArgumentMatchers.isNull(),
                org.mockito.ArgumentMatchers.eq("a@example.com"),
                org.mockito.ArgumentMatchers.eq(EmailTemplate.EMAIL_VERIFICATION),
                org.mockito.ArgumentMatchers.argThat(variables ->
                        "Ada".equals(variables.get("recipientName"))
                                && variables.get("verifyUrl").contains("raw-verify")
                )
        );
    }

    private QueueJob job(String template, java.util.function.Consumer<ObjectNode> customizer) {
        ObjectNode payload = objectMapper.createObjectNode();
        payload.put("template", template);
        customizer.accept(payload);
        Instant now = Instant.parse("2026-07-18T10:00:00Z");
        return new QueueJob(
                UUID.randomUUID(),
                QueueNames.EMAIL,
                payload,
                0,
                JobStatus.PROCESSING,
                now,
                1,
                5,
                "worker",
                now.plusSeconds(60),
                null,
                null,
                null,
                null,
                now,
                now
        );
    }
}
