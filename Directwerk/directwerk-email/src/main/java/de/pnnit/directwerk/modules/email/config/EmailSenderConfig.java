package de.pnnit.directwerk.modules.email.config;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.email.sender.EmailSender;
import de.pnnit.directwerk.modules.email.sender.NoneEmailSender;
import de.pnnit.directwerk.modules.email.sender.SmtpEmailSender;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.mail.javamail.JavaMailSender;

/**
 * Selects the outbound email transport. Add a new {@link EmailSender} implementation
 * and a {@code case} here when wiring Mailgun HTTP, Resend, or another ESP.
 */
@Configuration
public class EmailSenderConfig {

    @Bean
    EmailSender emailSender(DirectwerkConfig directwerkConfig, ObjectProvider<JavaMailSender> mailSender) {
        String provider = directwerkConfig.email() == null
                ? "none"
                : directwerkConfig.email().provider();
        return switch (provider) {
            case "smtp" -> {
                JavaMailSender sender = mailSender.getIfAvailable();
                yield sender == null ? new NoneEmailSender() : new SmtpEmailSender(sender);
            }
            default -> new NoneEmailSender();
        };
    }
}
