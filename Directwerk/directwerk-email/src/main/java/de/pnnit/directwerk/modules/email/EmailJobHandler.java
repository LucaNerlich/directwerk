package de.pnnit.directwerk.modules.email;

import de.pnnit.directwerk.modules.queue.JobHandler;
import de.pnnit.directwerk.modules.queue.QueueJob;
import de.pnnit.directwerk.modules.queue.QueueNames;
import java.util.HashMap;
import java.util.Map;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import tools.jackson.databind.ObjectMapper;

@Component
public class EmailJobHandler implements JobHandler {

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
            variables.put(template.tokenLink().variableName(), linkBuilder.buildTokenUrl(template, rawToken));
        }

        validateRequiredVariables(template, variables);

        transactionalEmailService.sendFromPayload(job.id(), job.tenantId(), payload.to(), template, variables);
    }

    private void validateRequiredVariables(EmailTemplate template, Map<String, String> variables) {
        switch (template) {
            case TENANT_INVITATION -> {
                requireVariable(variables, "recipientName", 200);
                requireVariable(variables, "tenantName", 200);
                requireVariable(variables, "role", 50);
                requireVariable(variables, "expiresIn", 100);
            }
            case PLATFORM_ADMIN_INVITATION -> {
                requireVariable(variables, "recipientName", 200);
                requireVariable(variables, "expiresIn", 100);
            }
            case PASSWORD_RESET -> {
                requireVariable(variables, "expiresIn", 100);
            }
            case EMAIL_VERIFICATION -> {
                requireVariable(variables, "recipientName", 200);
                requireVariable(variables, "expiresIn", 100);
            }
            case CONTENT_EPISODE_PUBLISHED, CONTENT_ARTICLE_PUBLISHED -> {
                requireVariable(variables, "recipientName", 200);
                requireVariable(variables, "tenantName", 200);
                requireVariable(variables, "siteTitle", 200);
                requireVariable(variables, "title", 255);
                requireVariable(variables, "excerpt", 2000, true);
                requireVariable(variables, "contentUrl", 2048);
                requireVariable(variables, "preferencesUrl", 2048);
                requireVariable(variables, "primaryColor", 32);
            }
        }
    }

    private void requireVariable(Map<String, String> variables, String key, int maxLength) {
        requireVariable(variables, key, maxLength, false);
    }

    private void requireVariable(Map<String, String> variables, String key, int maxLength, boolean allowBlank) {
        String value = variables.get(key);
        if (value == null) {
            throw new IllegalArgumentException("Email template variable '%s' is required".formatted(key));
        }
        if (!allowBlank && !StringUtils.hasText(value)) {
            throw new IllegalArgumentException("Email template variable '%s' is required".formatted(key));
        }
        if (value.length() > maxLength) {
            throw new IllegalArgumentException("Email template variable '%s' exceeds max length %d".formatted(key, maxLength));
        }
    }
}
