package de.pnnit.directwerk.modules.email.sender;

import java.util.Map;

/**
 * Provider-agnostic message. Domain code never builds this — only {@code TransactionalEmailService}.
 */
public record OutboundEmail(
        String to,
        String fromAddress,
        String fromName,
        String subject,
        String htmlBody,
        String plainTextBody,
        String jobId,
        String template,
        Map<String, String> headers
) {
    public OutboundEmail {
        headers = headers == null ? Map.of() : Map.copyOf(headers);
    }
}
