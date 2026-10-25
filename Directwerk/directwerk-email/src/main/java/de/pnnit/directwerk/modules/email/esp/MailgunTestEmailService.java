package de.pnnit.directwerk.modules.email.esp;

import de.pnnit.directwerk.modules.core.entity.MembershipStatus;
import de.pnnit.directwerk.modules.core.entity.Role;
import de.pnnit.directwerk.modules.core.entity.TenantMembership;
import de.pnnit.directwerk.modules.core.entity.UserStatus;
import de.pnnit.directwerk.modules.core.repository.TenantMembershipRepository;
import de.pnnit.directwerk.modules.email.sender.OutboundEmail;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/**
 * Sends a clearly marked Mailgun test message to every active tenant admin of the current tenant,
 * using that tenant's connected Mailgun credentials (never the platform sender).
 */
@Service
@RequiredArgsConstructor
public class MailgunTestEmailService {

    private static final Logger log = LoggerFactory.getLogger(MailgunTestEmailService.class);

    static final String TEST_SUBJECT = "[TEST] Directwerk Mailgun / Mailgun-Test";
    static final String TEST_PLAIN_BODY = """
            Dies ist eine Test-E-Mail von Directwerk.
            Ihre Mailgun-Verbindung für diesen Mandanten funktioniert.

            ---

            This is a Directwerk test email.
            Your Mailgun connection for this tenant is working.
            """;
    static final String TEST_HTML_BODY = """
            <p><strong>[TEST]</strong> Dies ist eine Test-E-Mail von Directwerk.<br/>
            Ihre Mailgun-Verbindung für diesen Mandanten funktioniert.</p>
            <hr/>
            <p><strong>[TEST]</strong> This is a Directwerk test email.<br/>
            Your Mailgun connection for this tenant is working.</p>
            """;

    private final TenantEspConnectionService tenantEspConnectionService;
    private final TenantMembershipRepository tenantMembershipRepository;
    private final MailgunHttpEmailSender mailgunHttpEmailSender;

    @Transactional(readOnly = true)
    public MailgunTestSendResult sendTestToTenantAdmins(Long tenantId) {
        TenantEspConnectionService.ResolvedEspCredentials credentials = tenantEspConnectionService
                .resolveActiveMailgun(tenantId)
                .orElseThrow(() -> new MailgunNotConfiguredException(
                        "Mailgun is not connected for this tenant"));

        List<String> adminEmails = resolveActiveTenantAdminEmails(tenantId);
        if (adminEmails.isEmpty()) {
            throw new NoTenantAdminsException("No active tenant admins with email addresses found");
        }

        List<RecipientResult> results = new ArrayList<>(adminEmails.size());
        int sentCount = 0;
        int failedCount = 0;

        for (String email : adminEmails) {
            try {
                mailgunHttpEmailSender.send(credentials, buildTestMessage(email, credentials));
                results.add(new RecipientResult(email, "SENT", null));
                sentCount++;
            } catch (RuntimeException ex) {
                // Never log credentials; keep message free of API keys.
                log.warn("Mailgun test send failed tenantId={} recipient={}", tenantId, email);
                results.add(new RecipientResult(email, "FAILED", safeFailureMessage(ex)));
                failedCount++;
            }
        }

        return new MailgunTestSendResult(sentCount, failedCount, List.copyOf(results));
    }

    private List<String> resolveActiveTenantAdminEmails(Long tenantId) {
        // Dedupe by normalized email (LinkedHashMap preserves discovery order).
        Map<String, String> emails = new LinkedHashMap<>();
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
            emails.putIfAbsent(normalized, normalized);
        }
        return emails.values().stream()
                .sorted(Comparator.naturalOrder())
                .toList();
    }

    private static OutboundEmail buildTestMessage(
            String to,
            TenantEspConnectionService.ResolvedEspCredentials credentials
    ) {
        return new OutboundEmail(
                to,
                credentials.fromEmail(),
                credentials.fromName(),
                TEST_SUBJECT,
                TEST_HTML_BODY,
                TEST_PLAIN_BODY,
                UUID.randomUUID().toString(),
                "MAILGUN_TEST",
                Map.of()
        );
    }

    private static String safeFailureMessage(Throwable ex) {
        String message = ex.getMessage();
        if (!StringUtils.hasText(message)) {
            return "Mailgun send failed";
        }
        // Defensive: never echo anything that looks like a key material leak.
        String lowered = message.toLowerCase(Locale.ROOT);
        if (lowered.contains("api") && lowered.contains("key")) {
            return "Mailgun send failed";
        }
        return message.length() > 500 ? message.substring(0, 500) : message;
    }

    public record MailgunTestSendResult(
            int sentCount,
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
