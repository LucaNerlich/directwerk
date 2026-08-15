package de.pnnit.directwerk.modules.email;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.email.sender.EmailDeliveryException;
import de.pnnit.directwerk.modules.email.sender.EmailSender;
import de.pnnit.directwerk.modules.email.sender.OutboundEmail;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class TransactionalEmailService {

    private static final Logger log = LoggerFactory.getLogger(TransactionalEmailService.class);

    private final DirectwerkConfig directwerkConfig;
    private final EmailSender emailSender;
    private final EmailTemplateRenderer templateRenderer;
    private final EmailDeliveryGuard emailDeliveryGuard;

    public TransactionalEmailService(
            DirectwerkConfig directwerkConfig,
            EmailSender emailSender,
            EmailTemplateRenderer templateRenderer,
            EmailDeliveryGuard emailDeliveryGuard
    ) {
        this.directwerkConfig = directwerkConfig;
        this.emailSender = emailSender;
        this.templateRenderer = templateRenderer;
        this.emailDeliveryGuard = emailDeliveryGuard;
    }

    public void sendTenantInvitation(
            UUID jobId,
            Long tenantId,
            String to,
            Map<String, String> variables
    ) {
        send(jobId, tenantId, to, EmailTemplate.TENANT_INVITATION, variables);
    }

    public void sendPlatformAdminInvitation(UUID jobId, String to, Map<String, String> variables) {
        send(jobId, null, to, EmailTemplate.PLATFORM_ADMIN_INVITATION, variables);
    }

    public void sendPasswordReset(UUID jobId, String to, Map<String, String> variables) {
        send(jobId, null, to, EmailTemplate.PASSWORD_RESET, variables);
    }

    public void sendEmailVerification(UUID jobId, Long tenantId, String to, Map<String, String> variables) {
        send(jobId, tenantId, to, EmailTemplate.EMAIL_VERIFICATION, variables);
    }

    public void sendFromPayload(
            UUID jobId,
            Long tenantId,
            String to,
            EmailTemplate template,
            Map<String, String> variables
    ) {
        send(jobId, tenantId, to, template, variables);
    }

    private void send(UUID jobId, Long tenantId, String to, EmailTemplate template, Map<String, String> variables) {
        if (!directwerkConfig.isEmailEnabled()) {
            log.debug("Email delivery disabled; skipping template={}", template.name());
            return;
        }
        if (!emailSender.isReady()) {
            throw new EmailDeliveryException(
                    "Email sender is not ready (provider=" + emailSender.providerId() + "); template=" + template.name());
        }
        if (!emailDeliveryGuard.tryClaimDelivery(jobId)) {
            log.info("Skipping duplicate email delivery for job={} template={}", jobId, template.name());
            return;
        }
        Map<String, String> renderVariables = new HashMap<>(variables == null ? Map.of() : variables);
        try {
            emailSender.send(new OutboundEmail(
                    to,
                    directwerkConfig.email().fromAddress(),
                    directwerkConfig.email().fromName(),
                    templateRenderer.renderSubject(template, tenantId, renderVariables),
                    templateRenderer.renderBody(template, tenantId, renderVariables),
                    templateRenderer.renderPlainTextBody(template, tenantId, renderVariables),
                    jobId.toString(),
                    template.name(),
                    Map.of()
            ));
            log.info("Sent email template={} job={} provider={}", template.name(), jobId, emailSender.providerId());
        } catch (RuntimeException ex) {
            // Release the durable claim on any failure (rendering, transport, DB) so the job can be
            // retried instead of being permanently dropped by the duplicate-delivery guard.
            emailDeliveryGuard.releaseClaim(jobId);
            log.error("Failed to send email template={} job={}", template.name(), jobId, ex);
            throw ex;
        }
    }
}
