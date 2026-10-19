package de.pnnit.directwerk.modules.email;

import de.pnnit.directwerk.modules.queue.JobHandler;
import de.pnnit.directwerk.modules.queue.QueueJob;
import de.pnnit.directwerk.modules.queue.QueueNames;
import java.util.HashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import tools.jackson.databind.ObjectMapper;

@Component
public class EmailJobHandler implements JobHandler {

    private static final Logger log = LoggerFactory.getLogger(EmailJobHandler.class);


    private final TransactionalEmailService transactionalEmailService;
    private final ObjectMapper objectMapper;
    private final EmailTokenProtector emailTokenProtector;
    private final EmailLinkBuilder linkBuilder;

    public EmailJobHandler(
            TransactionalEmailService transactionalEmailService,
            ObjectMapper objectMapper,
            EmailTokenProtector emailTokenProtector,
            EmailLinkBuilder linkBuilder
    ) {
        this.transactionalEmailService = transactionalEmailService;
        this.objectMapper = objectMapper;
        this.emailTokenProtector = emailTokenProtector;
        this.linkBuilder = linkBuilder;
    }

    @Override
    public String queueName() {
        return QueueNames.EMAIL;
    }

    @Override
    public boolean requiresTenant() {
        // The email queue carries both tenant-scoped jobs (invitation, verification,
        // content notification) and platform-scoped jobs (platform admin invitation,
        // password reset) that legitimately run with a null tenant.
        return false;
    }

    @Override
    public void handle(QueueJob job) {
        EmailJobPayload payload = objectMapper.convertValue(job.payload(), EmailJobPayload.class);
        if (payload == null || !StringUtils.hasText(payload.template()) || !StringUtils.hasText(payload.to())) {
            throw new IllegalArgumentException("Invalid email job payload");
        }

        EmailTemplate template = EmailTemplate.require(payload.template());
        Map<String, String> variables = new HashMap<>(payload.variables() == null ? Map.of() : payload.variables());

        if (template.requiresToken()) {
            if (!StringUtils.hasText(payload.token())) {
                throw new IllegalArgumentException("Email job payload missing token");
            }
            String rawToken = emailTokenProtector.revealFromQueue(payload.token());
            variables.put(
                    template.tokenLink().variableName(),
                    linkBuilder.buildTokenUrl(template, rawToken, job.tenantId())
            );
        }

        validateRequiredVariables(template, variables);

        transactionalEmailService.sendFromPayload(job.id(), job.tenantId(), payload.to(), template, variables);
    }

    private void validateRequiredVariables(EmailTemplate template, Map<String, String> variables) {
        switch (template) {
            case TENANT_INVITATION -> {
                requireDisplayVariable(variables, "recipientName", 200, false);
                requireDisplayVariable(variables, "tenantName", 200, false);
                requireVariable(variables, "role", 50);
                requireVariable(variables, "expiresIn", 100);
            }
            case PLATFORM_ADMIN_INVITATION -> {
                requireDisplayVariable(variables, "recipientName", 200, false);
                requireVariable(variables, "expiresIn", 100);
            }
            case PASSWORD_RESET -> {
                requireVariable(variables, "expiresIn", 100);
            }
            case EMAIL_VERIFICATION -> {
                requireDisplayVariable(variables, "recipientName", 200, false);
                requireVariable(variables, "expiresIn", 100);
            }
            case NEWSLETTER_CONFIRM -> {
                requireDisplayVariable(variables, "listName", 255, false);
                requireVariable(variables, "expiresIn", 100);
            }
            case CONTENT_EPISODE_PUBLISHED -> {
                requireDisplayVariable(variables, "recipientName", 200, false);
                requireDisplayVariable(variables, "tenantName", 200, false);
                requireDisplayVariable(variables, "siteTitle", 200, false);
                requireDisplayVariable(variables, "title", 255, false);
                requireDisplayVariable(variables, "excerpt", 2000, true);
                requireVariable(variables, "contentUrl", 2048);
                requireVariable(variables, "preferencesUrl", 2048);
                requireVariable(variables, "primaryColor", 32);
            }
            case CONTENT_ARTICLE_PUBLISHED, NEWSLETTER_ARTICLE_PUBLISHED -> {
                requireDisplayVariable(variables, "recipientName", 200, false);
                requireDisplayVariable(variables, "tenantName", 200, false);
                requireDisplayVariable(variables, "siteTitle", 200, false);
                requireDisplayVariable(variables, "title", 255, false);
                requireDisplayVariable(variables, "excerpt", 2000, true);
                requireVariable(variables, "contentUrl", 2048);
                // For NEWSLETTER_ARTICLE_PUBLISHED this is injected from the protected token above.
                requireVariable(variables, "unsubscribeUrl", 2048);
                requireVariable(variables, "primaryColor", 32);
            }
            case CONTACT_FORM -> {
                requireDisplayVariable(variables, "name", 120, false);
                requireVariable(variables, "email", 254);
                requireVariable(variables, "message", 5000);
            }
            case RSS_BULK_IMPORT_FINISHED -> {
                // validated by producer
            }
        }
    }

    private void requireVariable(Map<String, String> variables, String key, int maxLength) {
        requireVariable(variables, key, maxLength, false, false);
    }

    /**
     * #540: a display-only value is clamped, not rejected. These carry user- or tenant-authored
     * text (a 201-char name, an imported excerpt) that the write side accepts up to 255 chars —
     * failing the job instead retried it to exhaustion, so the recipient silently got nothing and
     * a claimed {@code emailNotifiedAt} meant the newsletter was never re-sent.
     */
    private void requireDisplayVariable(
            Map<String, String> variables, String key, int maxLength, boolean allowBlank) {
        requireVariable(variables, key, maxLength, allowBlank, true);
    }

    private void requireVariable(
            Map<String, String> variables, String key, int maxLength, boolean allowBlank, boolean clamp) {
        String value = variables.get(key);
        if (value == null) {
            throw new IllegalArgumentException("Email template variable '%s' is required".formatted(key));
        }
        if (!allowBlank && !StringUtils.hasText(value)) {
            throw new IllegalArgumentException("Email template variable '%s' is required".formatted(key));
        }
        if (value.length() > maxLength) {
            // Machine-generated values (token URLs, contentUrl, primaryColor) still fail closed:
            // truncating a signed URL would send a broken link.
            if (clamp) {
                // Review finding: clamping is silent otherwise — the operator loses the only trace
                // that a stored value exceeded the email cap (it used to surface as a FAILED job).
                log.warn(
                        "Clamping email variable {} from {} to {} characters",
                        key, value.length(), maxLength);
                variables.put(key, value.substring(0, maxLength));
                return;
            }
            throw new IllegalArgumentException("Email template variable '%s' exceeds max length %d".formatted(key, maxLength));
        }
    }
}
