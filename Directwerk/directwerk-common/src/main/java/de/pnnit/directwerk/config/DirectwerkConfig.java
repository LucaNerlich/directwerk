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

    /**
     * Provides the security configuration.
     *
     * @return the configured security properties
     */
    public DirectwerkProperties.Security security() {
        return properties.security();
    }

public DirectwerkProperties.Dev dev() {
        return properties.dev();
    }

    /**
     * Provides access to account-related configuration.
     *
     * @return the account configuration
     */
    public DirectwerkProperties.Account account() {
        return properties.account();
    }

    /**
     * Determines whether email verification is required for accounts.
     *
     * @return {@code true} if email verification is required, {@code false} otherwise
     */
    public boolean isEmailVerificationRequired() {
        return properties.account().emailVerificationRequired();
    }

    /**
     * Determines whether development tokens are exposed.
     *
     * @return {@code true} if development tokens are exposed, {@code false} otherwise
     */
    public boolean isExposeDevTokens() {
        return properties.account().exposeDevTokens();
    }

    /**
     * Provides access to email-related configuration.
     *
     * @return the email configuration
     */
    public DirectwerkProperties.Email email() {
        return properties.email();
    }

    /**
     * Determines whether transactional email can be enqueued and delivered.
     *
     * <p>Requires {@code directwerk.email.enabled=true} and a ready provider
     * ({@code smtp} today). {@code none} or an unimplemented provider stays off.
     *
     * @return {@code true} if email delivery is enabled, {@code false} otherwise
     */
    public boolean isEmailEnabled() {
        return properties.email() != null && properties.email().isDeliveryReady();
    }

    /**
     * Provides access to background job queue configuration.
     *
     * @return the queue configuration
     */
    public DirectwerkProperties.Queue queue() {
        return properties.queue();
    }

    /**
     * Determines whether queue processing is enabled.
     *
     * @return {@code true} if queue configuration exists and is enabled, {@code false} otherwise
     */
    public boolean isQueueEnabled() {
        return properties.queue() != null && properties.queue().enabled();
    }

    /**
     * Provides access to analytics tracking configuration.
     *
     * @return the analytics configuration
     */
    public DirectwerkProperties.Analytics analytics() {
        return properties.analytics();
    }

    /**
     * Determines whether analytics tracking is configured and enabled.
     *
     * @return {@code true} when analytics has an HTTPS Umami host and is enabled
     */
    public boolean isAnalyticsEnabled() {
        return properties.analytics() != null
                && properties.analytics().enabled()
                && properties.analytics().umamiHostUrl() != null
                && !properties.analytics().umamiHostUrl().isBlank();
    }

    /**
     * Provides access to object-storage configuration.
     *
     * @return the storage configuration
     */
    public DirectwerkProperties.Storage storage() {
        return properties.storage();
    }

    /**
     * Determines whether S3 client beans should be created.
     *
     * @return {@code true} when storage is configured and enabled
     */
    public boolean isStorageEnabled() {
        return properties.storage() != null && properties.storage().enabled();
    }

    /**
     * Provides access to platform marketing configuration (homepage contact form, ALTCHA).
     *
     * @return the marketing configuration
     */
    public DirectwerkProperties.Marketing marketing() {
        return properties.marketing();
    }

    /**
     * Determines whether the public homepage contact form can accept submissions.
     *
     * @return {@code true} when contact form, ALTCHA, inbox, and email delivery are configured
     */
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
