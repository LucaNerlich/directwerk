package de.pnnit.directwerk.modules.email;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.queue.JobEnqueueMetadata;
import de.pnnit.directwerk.modules.queue.QueueJob;
import de.pnnit.directwerk.modules.queue.QueueNames;
import de.pnnit.directwerk.modules.queue.QueueService;
import de.pnnit.directwerk.util.HumanReadableDuration;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

@Service
public class EmailJobProducer implements TransactionalEmailNotifier {

    public static final String QUEUE_NAME = QueueNames.EMAIL;

    private static final Logger log = LoggerFactory.getLogger(EmailJobProducer.class);

    private final DirectwerkConfig directwerkConfig;
    private final QueueService queueService;
    private final ObjectMapper objectMapper;
    private final EmailTokenProtector emailTokenProtector;

    public EmailJobProducer(
            DirectwerkConfig directwerkConfig,
            QueueService queueService,
            ObjectMapper objectMapper,
            EmailTokenProtector emailTokenProtector
    ) {
        this.directwerkConfig = directwerkConfig;
        this.queueService = queueService;
        this.objectMapper = objectMapper;
        this.emailTokenProtector = emailTokenProtector;
    }

    @Override
    public void sendTenantInvitation(
            Long tenantId,
            String to,
            String recipientName,
            String tenantName,
            String role,
            String inviteToken,
            Duration tokenLifetime
    ) {
        enqueue(
                tenantId,
                null,
                null,
                () -> payload(
                        EmailTemplate.TENANT_INVITATION,
                        to,
                        invitationVariables(recipientName, tenantName, role, tokenLifetime),
                        inviteToken
                )
        );
    }

    @Override
    public void sendPlatformAdminInvitation(
            String to,
            String recipientName,
            String inviteToken,
            Duration tokenLifetime
    ) {
        enqueue(
                null,
                null,
                null,
                () -> payload(
                        EmailTemplate.PLATFORM_ADMIN_INVITATION,
                        to,
                        namedRecipientVariables(recipientName, tokenLifetime),
                        inviteToken
                )
        );
    }

    @Override
    public void sendPasswordReset(String to, String resetToken, Duration tokenLifetime) {
        enqueue(
                null,
                null,
                null,
                () -> payload(
                        EmailTemplate.PASSWORD_RESET,
                        to,
                        Map.of("expiresIn", HumanReadableDuration.format(tokenLifetime)),
                        resetToken
                )
        );
    }

    @Override
    public void sendEmailVerification(
            Long tenantId,
            String to,
            String recipientName,
            String verificationToken,
            Duration tokenLifetime
    ) {
        enqueue(
                tenantId,
                null,
                null,
                () -> payload(
                        EmailTemplate.EMAIL_VERIFICATION,
                        to,
                        namedRecipientVariables(recipientName, tokenLifetime),
                        verificationToken
                )
        );
    }

    public void enqueueContentNotification(
            Long tenantId,
            String to,
            EmailTemplate template,
            Map<String, String> variables,
            String correlationId
    ) {
        if (template.requiresToken()) {
            throw new IllegalArgumentException("Content notification template must not require a token");
        }
        enqueue(tenantId, null, correlationId, () -> payload(template, to, variables, null));
    }

    private EmailJobPayload payload(
            EmailTemplate template,
            String to,
            Map<String, String> variables,
            String rawToken
    ) {
        String protectedToken = rawToken == null ? null : emailTokenProtector.protectForQueue(rawToken);
        return new EmailJobPayload(template.name(), to, variables, protectedToken);
    }

    private QueueJob enqueue(Long tenantId, Instant availableAt, String correlationId, Supplier<EmailJobPayload> payloadSupplier) {
        if (!directwerkConfig.isEmailEnabled()) {
            log.debug("Email delivery disabled; skipping enqueue");
            return null;
        }
        EmailJobPayload payload = payloadSupplier.get();
        QueueJob job = queueService.enqueue(
                QUEUE_NAME,
                objectMapper.valueToTree(payload),
                0,
                availableAt,
                null,
                new JobEnqueueMetadata(tenantId, correlationId, null)
        );
        log.info("Enqueued email job id={} template={}", job.id(), payload.template());
        return job;
    }

    private static Map<String, String> invitationVariables(
            String recipientName,
            String tenantName,
            String role,
            Duration tokenLifetime
    ) {
        Map<String, String> variables = new LinkedHashMap<>();
        variables.put("recipientName", defaultName(recipientName));
        variables.put("tenantName", tenantName);
        variables.put("role", role);
        variables.put("expiresIn", HumanReadableDuration.format(tokenLifetime));
        return variables;
    }

    private static Map<String, String> namedRecipientVariables(String recipientName, Duration tokenLifetime) {
        Map<String, String> variables = new LinkedHashMap<>();
        variables.put("recipientName", defaultName(recipientName));
        variables.put("expiresIn", HumanReadableDuration.format(tokenLifetime));
        return variables;
    }

    private static String defaultName(String recipientName) {
        return org.springframework.util.StringUtils.hasText(recipientName) ? recipientName : "there";
    }
}
