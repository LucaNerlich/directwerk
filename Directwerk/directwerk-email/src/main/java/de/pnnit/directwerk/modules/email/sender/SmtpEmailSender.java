package de.pnnit.directwerk.modules.email.sender;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import java.io.UnsupportedEncodingException;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.util.StringUtils;

/**
 * SMTP transport (Mailpit locally, Mailgun SMTP or any other SMTP relay in stage/prod).
 *
 * <p>All header-bound values ({@code to}, {@code from}, subject, custom headers) are
 * validated via {@link EmailMessageValidator} before touching Jakarta Mail: CR/LF
 * sequences would otherwise allow SMTP header injection via user-controlled inputs such
 * as the contact-form Reply-To address or episode titles rendered into notification
 * subjects.
 */
public class SmtpEmailSender implements EmailSender {

    private final JavaMailSender mailSender;

    public SmtpEmailSender(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    @Override
    public String providerId() {
        return "smtp";
    }

    @Override
    public boolean isReady() {
        return mailSender != null;
    }

    @Override
    public void send(OutboundEmail email) {
        if (email == null || !StringUtils.hasText(email.to()) || !StringUtils.hasText(email.fromAddress())) {
            throw new EmailDeliveryException("Email message is incomplete");
        }
        EmailMessageValidator.requireAddress("to", email.to());
        EmailMessageValidator.requireAddress("from", email.fromAddress());
        EmailMessageValidator.requireDisplayName(email.fromName());
        EmailMessageValidator.requireNoLineBreaks("subject", email.subject());
        EmailMessageValidator.requireNoLineBreaks("jobId", email.jobId());
        EmailMessageValidator.requireHeaders(email.headers());
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setTo(email.to().trim());
            if (StringUtils.hasText(email.fromName())) {
                helper.setFrom(email.fromAddress().trim(), email.fromName().trim());
            } else {
                helper.setFrom(email.fromAddress().trim());
            }
            helper.setSubject(email.subject() == null ? "" : email.subject());
            helper.setText(
                    email.plainTextBody() == null ? "" : email.plainTextBody(),
                    email.htmlBody() == null ? "" : email.htmlBody()
            );
            if (StringUtils.hasText(email.jobId())) {
                message.setHeader("X-Directwerk-Job-Id", email.jobId().trim());
            }
            String stableMessageId = null;
            if (email.headers() != null) {
                for (var header : email.headers().entrySet()) {
                    if (StringUtils.hasText(header.getKey()) && header.getValue() != null) {
                        if ("Reply-To".equalsIgnoreCase(header.getKey())) {
                            EmailMessageValidator.requireAddress("Reply-To", header.getValue());
                            helper.setReplyTo(header.getValue().trim());
                        } else if ("Message-ID".equalsIgnoreCase(header.getKey())) {
                            stableMessageId = header.getValue();
                        } else {
                            message.setHeader(header.getKey(), header.getValue());
                        }
                    }
                }
            }
            if (stableMessageId != null) {
                // Save first, then copy: the copy constructor serializes the source message.
                message.saveChanges();
                message = new StableMessageIdMimeMessage(message);
                message.setHeader("Message-ID", stableMessageId);
            }
            mailSender.send(message);
        } catch (MailException | MessagingException | UnsupportedEncodingException ex) {
            throw new EmailDeliveryException("Email delivery failed", ex);
        }
    }

    /**
     * Issue #580: Jakarta Mail overwrites Message-ID unconditionally in every
     * {@code saveChanges()}, and Spring's JavaMailSenderImpl saves again right before handing the
     * message to the transport — so a caller-supplied Message-ID never reached the wire. Keeping
     * the header when it is already present preserves the stable id a retry needs for dedupe.
     */
    static final class StableMessageIdMimeMessage extends MimeMessage {

        StableMessageIdMimeMessage(MimeMessage source) throws MessagingException {
            super(source);
        }

        @Override
        protected void updateMessageID() throws MessagingException {
            if (getHeader("Message-ID") == null) {
                super.updateMessageID();
            }
        }
    }
}
