package de.pnnit.directwerk.modules.email;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.core.util.EnvelopeCipher;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class EmailTokenProtector {

    private final DirectwerkConfig directwerkConfig;

    public EmailTokenProtector(DirectwerkConfig directwerkConfig) {
        this.directwerkConfig = directwerkConfig;
    }

    public String protectForQueue(String rawToken) {
        return EnvelopeCipher.encrypt(rawToken, keyMaterial());
    }

    public String revealFromQueue(String storedToken) {
        return EnvelopeCipher.decrypt(storedToken, keyMaterial());
    }

    private String keyMaterial() {
        String platformSecret = directwerkConfig.security().platformClientSecret();
        String tenantSecret = directwerkConfig.security().tenantClientSecret();
        if (!StringUtils.hasText(platformSecret) || !StringUtils.hasText(tenantSecret)) {
            throw new IllegalStateException("OAuth client secrets must be configured for email queue token protection");
        }
        return platformSecret + "|" + tenantSecret;
    }
}
