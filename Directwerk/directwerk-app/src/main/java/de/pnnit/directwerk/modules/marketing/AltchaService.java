package de.pnnit.directwerk.modules.marketing;

import de.pnnit.directwerk.config.DirectwerkConfig;
import org.altcha.altcha.v2.Altcha;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class AltchaService {

    private final DirectwerkConfig directwerkConfig;

    public AltchaService(DirectwerkConfig directwerkConfig) {
        this.directwerkConfig = directwerkConfig;
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
            Altcha.VerifySolutionResult result = Altcha.verifySolution(payload.trim(), hmacKey, Altcha.pbkdf2());
            if (!result.verified() || result.expired()) {
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
