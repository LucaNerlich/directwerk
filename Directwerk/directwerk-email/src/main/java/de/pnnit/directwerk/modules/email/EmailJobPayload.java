package de.pnnit.directwerk.modules.email;

import java.util.Map;

/**
 * JSON payload for jobs on the {@code email} queue.
 *
 * @param template  email template key
 * @param to        recipient address
 * @param variables template placeholders (excluding token-derived URLs)
 * @param token     optional envelope-encrypted bearer token for link building at send time
 */
public record EmailJobPayload(
        String template,
        String to,
        Map<String, String> variables,
        String token
) {
}
