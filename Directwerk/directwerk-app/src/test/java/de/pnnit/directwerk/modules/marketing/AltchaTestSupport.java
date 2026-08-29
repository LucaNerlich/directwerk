package de.pnnit.directwerk.modules.marketing;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import org.altcha.altcha.v2.Altcha;
import org.json.JSONObject;

final class AltchaTestSupport {

    private AltchaTestSupport() {
    }

    static String createValidPayload(String hmacKey) throws Exception {
        var challenge = Altcha.createChallenge(new Altcha.CreateChallengeOptions()
                .algorithm("PBKDF2/SHA-256")
                .cost(5_000)
                .hmacSignatureSecret(hmacKey)
                .expiresInSeconds(300));
        var solution = Altcha.solveChallenge(challenge, Altcha.pbkdf2());

        var root = new JSONObject();
        root.put("challenge", new JSONObject(challenge.toJson()));
        var solutionJson = new JSONObject();
        solutionJson.put("counter", solution.counter());
        solutionJson.put("derivedKey", solution.derivedKey());
        if (solution.time() != null) {
            solutionJson.put("time", solution.time());
        }
        root.put("solution", solutionJson);

        return Base64.getEncoder().encodeToString(root.toString().getBytes(StandardCharsets.UTF_8));
    }
}
