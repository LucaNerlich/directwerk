package de.pnnit.directwerk.modules.email;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.email.esp.MailgunHttpEmailSender;
import de.pnnit.directwerk.modules.email.esp.TenantEspConnectionService;
import de.pnnit.directwerk.modules.email.sender.EmailDeliveryException;
import de.pnnit.directwerk.modules.email.sender.EmailSender;
import de.pnnit.directwerk.modules.email.sender.OutboundEmail;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
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
    private final TenantEspConnectionService tenantEspConnectionService;
    private final MailgunHttpEmailSender mailgunHttpEmailSender;

    public TransactionalEmailService(
            DirectwerkConfig directwerkConfig,
            EmailSender emailSender,
            EmailTemplateRenderer templateRenderer,
            EmailDeliveryGuard emailDeliveryGuard,
            TenantEspConnectionService tenantEspConnectionService,
            MailgunHttpEmailSender mailgunHttpEmailSender
    ) {
        this.directwerkConfig = directwerkConfig;
        this.emailSender = emailSender;
        this.templateRenderer = templateRenderer;
        this.emailDeliveryGuard = emailDeliveryGuard;
        this.tenantEspConnectionService = tenantEspConnectionService;
        this.mailgunHttpEmailSender = mailgunHttpEmailSender;
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
        Optional<TenantEspConnectionService.ResolvedEspCredentials> mailgun =
                tenantId == null ? Optional.empty() : tenantEspConnectionService.resolveActiveMailgun(tenantId);
        if (mailgun.isEmpty() && !emailSender.isReady()) {
            throw new EmailDeliveryException(
                    "Email sender is not ready (provider=" + emailSender.providerId() + "); template=" + template.name());
        }
        Optional<EmailDeliveryGuard.DeliveryClaim> claimed = emailDeliveryGuard.tryClaimDelivery(jobId);
        if (claimed.isEmpty()) {
            log.info("Skipping duplicate email delivery for job={} template={}", jobId, template.name());
            return;
        }
        Map<String, String> renderVariables = new HashMap<>(variables == null ? Map.of() : variables);
        Map<String, String> headers = new HashMap<>();
        // Stable message identity lets SMTP relays and HTTP ESPs deduplicate a retry that
        // overlaps a stale sender after ownership has been taken over.
        headers.put("Message-ID", "<" + jobId + "@directwerk.local>");
        if (template == EmailTemplate.CONTACT_FORM) {
            String replyTo = renderVariables.get("email");
            if (org.springframework.util.StringUtils.hasText(replyTo)) {
                headers.put("Reply-To", replyTo.trim());
            }
        }
        try {
            OutboundEmail outbound = new OutboundEmail(
                    to,
                    mailgun.map(TenantEspConnectionService.ResolvedEspCredentials::fromEmail)
                            .orElseGet(() -> directwerkConfig.email().fromAddress()),
                    mailgun.map(creds -> creds.fromName() != null
                                    ? creds.fromName()
                                    : directwerkConfig.email().fromName())
                            .orElseGet(() -> directwerkConfig.email().fromName()),
                    templateRenderer.renderSubject(template, tenantId, renderVariables),
                    templateRenderer.renderBody(template, tenantId, renderVariables),
                    templateRenderer.renderPlainTextBody(template, tenantId, renderVariables),
                    jobId.toString(),
                    template.name(),
                    headers
            );
            boolean sent = emailDeliveryGuard.finalizeClaim(claimed.get(), () -> {
                if (mailgun.isPresent()) {
                    mailgunHttpEmailSender.send(mailgun.get(), outbound);
                    log.info("Sent email template={} job={} provider=mailgun-tenant", template.name(), jobId);
                } else {
                    emailSender.send(outbound);
                    log.info("Sent email template={} job={} provider={}",
                            template.name(), jobId, emailSender.providerId());
                }
            });
            if (!sent) {
                log.info("Skipping email delivery after claim ownership changed for job={} template={}",
                        jobId, template.name());
            }
        } catch (RuntimeException ex) {
            emailDeliveryGuard.releaseClaim(claimed.get());
            throw ex;
        }
    }
}
