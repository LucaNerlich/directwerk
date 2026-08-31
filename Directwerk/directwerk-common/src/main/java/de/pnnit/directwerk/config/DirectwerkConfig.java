package de.pnnit.directwerk.config;

import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class DirectwerkConfig {

    private final DirectwerkProperties properties;

    public DirectwerkConfig(DirectwerkProperties properties) {
        this.properties = properties;
    }

    public DirectwerkProperties properties() {
        return properties;
    }

    public DirectwerkProperties.Security security() {
        return properties.security();
    }

    public DirectwerkProperties.Dev dev() {
        return properties.dev();
    }

    public DirectwerkProperties.Account account() {
        return properties.account();
    }

    public boolean isEmailVerificationRequired() {
        return properties.account().emailVerificationRequired();
    }

    public boolean isExposeDevTokens() {
        return properties.account().exposeDevTokens();
    }

    public DirectwerkProperties.Email email() {
        return properties.email();
    }

    /** True when {@code directwerk.email.provider} is {@code smtp}; {@code none} disables delivery for local runs. */
    public boolean isEmailEnabled() {
        return properties.email() != null && properties.email().isDeliveryReady();
    }

    public DirectwerkProperties.Queue queue() {
        return properties.queue();
    }

    public boolean isQueueEnabled() {
        return properties.queue() != null && properties.queue().enabled();
    }

    public DirectwerkProperties.Analytics analytics() {
        return properties.analytics();
    }

    public boolean isAnalyticsEnabled() {
        return properties.analytics() != null
                && properties.analytics().enabled()
                && properties.analytics().umamiHostUrl() != null
                && !properties.analytics().umamiHostUrl().isBlank();
    }

    public DirectwerkProperties.Storage storage() {
        return properties.storage();
    }

    public boolean isStorageEnabled() {
        return properties.storage() != null && properties.storage().enabled();
    }

    public DirectwerkProperties.Marketing marketing() {
        return properties.marketing();
    }

    /** Requires contact form + ALTCHA + inbox + email delivery all configured — a half-configured form fails closed. */
    public boolean isContactFormEnabled() {
        DirectwerkProperties.Contact contact = properties.marketing().contact();
        DirectwerkProperties.Altcha altcha = contact.altcha();
        return contact.enabled()
                && StringUtils.hasText(contact.inboxEmail())
                && altcha != null
                && StringUtils.hasText(altcha.hmacKey())
                && isEmailEnabled();
    }
}
