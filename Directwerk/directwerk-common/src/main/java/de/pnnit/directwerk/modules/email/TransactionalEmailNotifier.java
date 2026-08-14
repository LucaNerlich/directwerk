package de.pnnit.directwerk.modules.email;

import java.time.Duration;

/**
 * Port for enqueueing transactional email without coupling domain modules to the email transport.
 */
public interface TransactionalEmailNotifier {

    void sendTenantInvitation(
            Long tenantId,
            String to,
            String recipientName,
            String tenantName,
            String role,
            String inviteToken,
            Duration tokenLifetime
    );

    void sendPlatformAdminInvitation(
            String to,
            String recipientName,
            String inviteToken,
            Duration tokenLifetime
    );

    void sendPasswordReset(String to, String resetToken, Duration tokenLifetime);

    void sendEmailVerification(
            Long tenantId,
            String to,
            String recipientName,
            String verificationToken,
            Duration tokenLifetime
    );
}
