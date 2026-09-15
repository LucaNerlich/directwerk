package de.pnnit.directwerk.modules.email;

import de.pnnit.directwerk.modules.core.util.EnvelopeTokenProtector;
import org.springframework.stereotype.Component;

/**
 * Thin adapter over {@link EnvelopeTokenProtector} for tokens carried in durable
 * email queue jobs. The raw token is only reconstructed when the job is delivered,
 * so the queue never stores it in cleartext.
 */
@Component
public class EmailTokenProtector {

    private final EnvelopeTokenProtector envelopeTokenProtector;

    public EmailTokenProtector(EnvelopeTokenProtector envelopeTokenProtector) {
        this.envelopeTokenProtector = envelopeTokenProtector;
    }

    public String protectForQueue(String rawToken) {
        return envelopeTokenProtector.protect(rawToken);
    }

    public String revealFromQueue(String storedToken) {
        return envelopeTokenProtector.reveal(storedToken);
    }
}
