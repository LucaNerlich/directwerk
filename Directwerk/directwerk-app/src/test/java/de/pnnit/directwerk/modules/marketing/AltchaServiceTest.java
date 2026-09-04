package de.pnnit.directwerk.modules.marketing;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import java.util.List;
import org.altcha.altcha.v2.Altcha;
import org.junit.jupiter.api.Test;

class AltchaServiceTest {

    @Test
    void createChallengeAndVerifySolutionRoundTrip() throws Exception {
        AltchaService service = serviceWithKey("integration-test-hmac-key");

        String challengeJson = service.createChallengeJson();
        assertThat(challengeJson).contains("signature");

        var challenge = Altcha.createChallenge(new Altcha.CreateChallengeOptions()
                .algorithm("PBKDF2/SHA-256")
                .cost(5_000)
                .hmacSignatureSecret("integration-test-hmac-key")
                .expiresInSeconds(300));
        var solution = Altcha.solveChallenge(challenge, Altcha.pbkdf2());
        var verification = Altcha.verifySolution(challenge, solution, "integration-test-hmac-key", Altcha.pbkdf2());

        assertThat(verification.verified()).isTrue();
        assertThat(verification.expired()).isFalse();
    }

    @Test
    void verifyPayloadRejectsBlankCaptcha() {
        AltchaService service = serviceWithKey("integration-test-hmac-key");

        assertThatThrownBy(() -> service.verifyPayload(" "))
                .isInstanceOf(CaptchaVerificationException.class);
    }

    @Test
    void verifyPayloadRejectsReplayedChallenge() throws Exception {
        AltchaService service = serviceWithKey("integration-test-hmac-key");
        String payload = AltchaTestSupport.createValidPayload("integration-test-hmac-key");

        service.verifyPayload(payload);

        assertThatThrownBy(() -> service.verifyPayload(payload))
                .isInstanceOf(CaptchaVerificationException.class);
    }

    @Test
    void createChallengeFailsWhenDisabled() {
        DirectwerkConfig config = new DirectwerkConfig(new DirectwerkProperties(
                null,
                null,
                null,
                null,
                new DirectwerkProperties.Email(
                        "smtp",
                        "noreply@example.com",
                        "Directwerk",
                        null,
                        null,
                        null,
                        null,
                        null,
                        7L
                ),
                null,
                null,
                null,
                new DirectwerkProperties.Marketing(new DirectwerkProperties.Contact(
                        false,
                        "hello@directwerk.org",
                        5,
                        List.of(),
                        new DirectwerkProperties.Altcha("key", 300)
                ))
        ));
        AltchaService service = new AltchaService(config);

        assertThatThrownBy(service::createChallengeJson)
                .isInstanceOf(ContactFormDisabledException.class);
    }

    static AltchaService serviceWithKey(String hmacKey) {
        DirectwerkConfig config = new DirectwerkConfig(new DirectwerkProperties(
                null,
                null,
                null,
                null,
                new DirectwerkProperties.Email(
                        "smtp",
                        "noreply@example.com",
                        "Directwerk",
                        null,
                        null,
                        null,
                        null,
                        null,
                        7L
                ),
                null,
                null,
                null,
                new DirectwerkProperties.Marketing(new DirectwerkProperties.Contact(
                        true,
                        "hello@directwerk.org",
                        5,
                        List.of("http://localhost:3005"),
                        new DirectwerkProperties.Altcha(hmacKey, 300)
                ))
        ));
        return new AltchaService(config);
    }
}
