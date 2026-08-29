package de.pnnit.directwerk.modules.marketing;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import de.pnnit.directwerk.config.DirectwerkConfig;
import java.time.Duration;
import org.altcha.altcha.v2.Altcha;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class AltchaService {

    private final DirectwerkConfig directwerkConfig;
    private final Cache<String, Boolean> consumedChallenges;

    public AltchaService(DirectwerkConfig directwerkConfig) {
        this.directwerkConfig = directwerkConfig;
        int expiresSeconds = directwerkConfig.marketing().contact().altcha().expiresSeconds();
        this.consumedChallenges = Caffeine.newBuilder()
                .expireAfterWrite(Duration.ofSeconds(expiresSeconds))
                .maximumSize(100_000)
                .build();
    }

    public String createChallengeJson() {
        requireConfigured();
        var altcha = directwerkConfig.marketing().contact().altcha();
        try {
            var options = new Altcha.CreateChallengeOptions()
                    .algorithm("PBKDF2/SHA-256")
                    .cost(5_000)
                    .hmacSignatureSecret(altcha.hmacKey())
                    .expiresInSeconds(altcha.expiresSeconds());
            return Altcha.createChallenge(options).toJson();
        } catch (Exception ex) {
            throw new IllegalStateException("Failed to create ALTCHA challenge", ex);
        }
    }

    public void verifyPayload(String payload) {
        requireConfigured();
        if (!StringUtils.hasText(payload)) {
            throw new CaptchaVerificationException();
        }
        String hmacKey = directwerkConfig.marketing().contact().altcha().hmacKey();
        try {
            String normalizedPayload = payload.trim();
            Altcha.VerifySolutionResult result =
                    Altcha.verifySolution(normalizedPayload, hmacKey, Altcha.pbkdf2());
            if (!result.verified() || result.expired()) {
                throw new CaptchaVerificationException();
            }
            String challengeId = Altcha.parsePayload(normalizedPayload).challenge().signature();
            if (consumedChallenges.asMap().putIfAbsent(challengeId, Boolean.TRUE) != null) {
                throw new CaptchaVerificationException();
            }
        } catch (CaptchaVerificationException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new CaptchaVerificationException();
        }
    }

    private void requireConfigured() {
        if (!directwerkConfig.isContactFormEnabled()) {
            throw new ContactFormDisabledException();
        }
    }
}
