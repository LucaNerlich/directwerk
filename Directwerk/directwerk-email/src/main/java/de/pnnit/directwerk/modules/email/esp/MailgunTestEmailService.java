package de.pnnit.directwerk.modules.email.esp;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.core.entity.MembershipStatus;
import de.pnnit.directwerk.modules.core.entity.Role;
import de.pnnit.directwerk.modules.core.entity.TenantMembership;
import de.pnnit.directwerk.modules.core.entity.UserStatus;
import de.pnnit.directwerk.modules.core.repository.TenantMembershipRepository;
import de.pnnit.directwerk.modules.email.EmailJobProducer;
import de.pnnit.directwerk.modules.email.EmailTemplate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/**
 * Enqueues one {@link EmailTemplate#MAILGUN_CONNECTION_TEST} job per active tenant admin via the
 * normal email queue (same path as transactional mail). Does not call Mailgun directly.
 * <p>
 * Not {@code @Transactional}: each {@link EmailJobProducer#enqueueContentNotification} must commit
 * on its own {@link de.pnnit.directwerk.modules.queue.QueueService#enqueue} transaction. An outer
 * read-only (or catch-and-continue) TX would block or roll back durable job inserts.
 */
@Service
@RequiredArgsConstructor
public class MailgunTestEmailService {

    private static final Logger log = LoggerFactory.getLogger(MailgunTestEmailService.class);

    private final DirectwerkConfig directwerkConfig;
    private final TenantEspConnectionService tenantEspConnectionService;
    private final TenantMembershipRepository tenantMembershipRepository;
    private final EmailJobProducer emailJobProducer;

    public MailgunTestSendResult sendTestToTenantAdmins(Long tenantId) {
        if (!directwerkConfig.isEmailEnabled()) {
            throw new MailgunNotConfiguredException("Email delivery is disabled");
        }
        tenantEspConnectionService
                .resolveActiveMailgun(tenantId)
                .orElseThrow(() -> new MailgunNotConfiguredException(
                        "Mailgun is not connected for this tenant"));

        List<AdminRecipient> admins = resolveActiveTenantAdmins(tenantId);
        if (admins.isEmpty()) {
            throw new NoTenantAdminsException("No active tenant admins with email addresses found");
        }

        List<RecipientResult> results = new ArrayList<>(admins.size());
        int queuedCount = 0;
        int failedCount = 0;

        for (AdminRecipient admin : admins) {
            try {
                emailJobProducer.enqueueContentNotification(
                        tenantId,
                        admin.email(),
                        EmailTemplate.MAILGUN_CONNECTION_TEST,
                        Map.of("recipientName", admin.displayName()),
                        null
                );
                results.add(new RecipientResult(admin.email(), "QUEUED", null));
                queuedCount++;
            } catch (RuntimeException ex) {
                log.warn("Mailgun test enqueue failed tenantId={} recipient={}", tenantId, admin.email());
                results.add(new RecipientResult(admin.email(), "FAILED", safeFailureMessage(ex)));
                failedCount++;
            }
        }

        return new MailgunTestSendResult(queuedCount, failedCount, List.copyOf(results));
    }

    private List<AdminRecipient> resolveActiveTenantAdmins(Long tenantId) {
        Map<String, AdminRecipient> byEmail = new LinkedHashMap<>();
        for (TenantMembership membership : tenantMembershipRepository.findByTenantId(tenantId)) {
            if (membership.getStatus() != MembershipStatus.ACTIVE) {
                continue;
            }
            if (membership.getRoles() == null || !membership.getRoles().contains(Role.TENANT_ADMIN)) {
                continue;
            }
            if (membership.getUser() == null || membership.getUser().getStatus() != UserStatus.ACTIVE) {
                continue;
            }
            String email = membership.getUser().getEmail();
            if (!StringUtils.hasText(email)) {
                continue;
            }
            String normalized = email.trim().toLowerCase(Locale.ROOT);
            String name = membership.getUser().getName();
            byEmail.putIfAbsent(normalized, new AdminRecipient(
                    normalized,
                    StringUtils.hasText(name) ? name.trim() : "there"
            ));
        }
        return byEmail.values().stream()
                .sorted(Comparator.comparing(AdminRecipient::email))
                .toList();
    }

    private static String safeFailureMessage(Throwable ex) {
        String message = ex.getMessage();
        if (!StringUtils.hasText(message)) {
            return "Email enqueue failed";
        }
        String lowered = message.toLowerCase(Locale.ROOT);
        if (lowered.contains("api") && lowered.contains("key")) {
            return "Email enqueue failed";
        }
        return message.length() > 500 ? message.substring(0, 500) : message;
    }

    private record AdminRecipient(String email, String displayName) {
    }

    public record MailgunTestSendResult(
            int queuedCount,
            int failedCount,
            List<RecipientResult> results
    ) {
    }

    public record RecipientResult(
            String email,
            String status,
            String error
    ) {
    }
}
