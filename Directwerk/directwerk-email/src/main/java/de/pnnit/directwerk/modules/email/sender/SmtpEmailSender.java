package de.pnnit.directwerk.modules.email.sender;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.util.StringUtils;

/**
 * SMTP transport (Mailpit locally, Mailgun SMTP or any other SMTP relay in stage/prod).
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
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setTo(email.to());
            helper.setFrom(formatFromAddress(email.fromName(), email.fromAddress()));
            helper.setSubject(email.subject());
            helper.setText(
                    email.plainTextBody() == null ? "" : email.plainTextBody(),
                    email.htmlBody() == null ? "" : email.htmlBody()
            );
            if (StringUtils.hasText(email.jobId())) {
                message.setHeader("X-Directwerk-Job-Id", email.jobId());
            }
            if (email.headers() != null) {
                for (var header : email.headers().entrySet()) {
                    if (StringUtils.hasText(header.getKey()) && header.getValue() != null) {
                        message.setHeader(header.getKey(), header.getValue());
                    }
                }
            }
            mailSender.send(message);
        } catch (MailException | MessagingException ex) {
            throw new EmailDeliveryException("Email delivery failed", ex);
        }
    }

    private static String formatFromAddress(String fromName, String fromAddress) {
        if (!StringUtils.hasText(fromName)) {
            return fromAddress;
        }
        return fromName + " <" + fromAddress + ">";
    }
}
