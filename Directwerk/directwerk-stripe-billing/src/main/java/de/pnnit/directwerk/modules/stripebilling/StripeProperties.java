package de.pnnit.directwerk.modules.stripebilling;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "directwerk.stripe")
public record StripeProperties(
        String secretKey,
        String publishableKey,
        String webhookSecret,
        String connectClientId
) {

    public StripeProperties {
        secretKey = secretKey == null ? "" : secretKey.trim();
        publishableKey = publishableKey == null ? "" : publishableKey.trim();
        webhookSecret = webhookSecret == null ? "" : webhookSecret.trim();
        connectClientId = connectClientId == null ? "" : connectClientId.trim();
    }

    public boolean isConfigured() {
        return !secretKey.isBlank();
    }

    public boolean isWebhookConfigured() {
        return isConfigured() && !webhookSecret.isBlank();
    }
}
