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
 * validated before touching Jakarta Mail: CR/LF sequences would otherwise allow SMTP
 * header injection via user-controlled inputs such as the contact-form Reply-To address
 * or episode titles rendered into notification subjects.
 */
public class SmtpEmailSender implements EmailSender {

    private static final int MAX_ADDRESS_LENGTH = 254;
    private static final int MAX_DISPLAY_NAME_LENGTH = 200;
    private static final int MAX_HEADER_NAME_LENGTH = 100;
    private static final int MAX_HEADER_VALUE_LENGTH = 2000;

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
        requireAddress("to", email.to());
        requireAddress("from", email.fromAddress());
        requireDisplayName(email.fromName());
        requireNoLineBreaks("subject", email.subject());
        requireNoLineBreaks("jobId", email.jobId());
        requireHeaders(email.headers());
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
            if (email.headers() != null) {
                for (var header : email.headers().entrySet()) {
                    if (StringUtils.hasText(header.getKey()) && header.getValue() != null) {
                        if ("Reply-To".equalsIgnoreCase(header.getKey())) {
                            requireAddress("Reply-To", header.getValue());
                            helper.setReplyTo(header.getValue().trim());
                        } else {
                            message.setHeader(header.getKey(), header.getValue());
                        }
                    }
                }
            }
            mailSender.send(message);
        } catch (MailException | MessagingException | UnsupportedEncodingException ex) {
            throw new EmailDeliveryException("Email delivery failed", ex);
        }
    }

    private static void requireHeaders(java.util.Map<String, String> headers) {
        if (headers == null) {
            return;
        }
        for (var header : headers.entrySet()) {
            String name = header.getKey();
            String value = header.getValue();
            if (!StringUtils.hasText(name) || value == null) {
                continue;
            }
            if (name.length() > MAX_HEADER_NAME_LENGTH
                    || name.indexOf(':') >= 0
                    || containsLineBreak(name)) {
                throw new EmailDeliveryException("Email header name is invalid");
            }
            if (value.length() > MAX_HEADER_VALUE_LENGTH || containsLineBreak(value)) {
                throw new EmailDeliveryException("Email header value is invalid");
            }
        }
    }

    private static void requireAddress(String field, String value) {
        if (value == null || containsLineBreak(value)) {
            throw new EmailDeliveryException("Email " + field + " is invalid");
        }
        String trimmed = value.trim();
        if (trimmed.isEmpty()
                || trimmed.length() > MAX_ADDRESS_LENGTH
                || trimmed.contains(" ")
                || trimmed.contains(",")
                || trimmed.contains(";")
                || trimmed.contains("<")
                || trimmed.contains(">")
                || trimmed.indexOf('@') <= 0
                || trimmed.indexOf('@') != trimmed.lastIndexOf('@')) {
            throw new EmailDeliveryException("Email " + field + " is invalid");
        }
    }

    private static void requireDisplayName(String value) {
        if (!StringUtils.hasText(value)) {
            return;
        }
        if (value.length() > MAX_DISPLAY_NAME_LENGTH || containsLineBreak(value)) {
            throw new EmailDeliveryException("Email fromName is invalid");
        }
    }

    private static void requireNoLineBreaks(String field, String value) {
        if (containsLineBreak(value)) {
            throw new EmailDeliveryException("Email " + field + " must not contain line breaks");
        }
    }

    private static boolean containsLineBreak(String value) {
        return value != null && (value.indexOf('\r') >= 0 || value.indexOf('\n') >= 0);
    }
}
