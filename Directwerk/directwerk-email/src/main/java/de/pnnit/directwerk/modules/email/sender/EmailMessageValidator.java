package de.pnnit.directwerk.modules.email.sender;

import java.util.Map;
import org.springframework.util.StringUtils;

/**
 * Header-bound validation for the email transports, mirroring the checks the SMTP sender
 * applies before touching Jakarta Mail.
 *
 * <p>All values that end up in an RFC 5322 header ({@code to}, {@code from}, display name,
 * subject, custom headers) must reject CR/LF sequences: user-controlled inputs such as a
 * contact-form Reply-To address or an episode title rendered into a notification subject
 * would otherwise allow header/recipient injection.
 */
public final class EmailMessageValidator {

    public static final int MAX_ADDRESS_LENGTH = 254;
    public static final int MAX_DISPLAY_NAME_LENGTH = 200;
    public static final int MAX_HEADER_NAME_LENGTH = 100;
    public static final int MAX_HEADER_VALUE_LENGTH = 2000;

    private EmailMessageValidator() {
    }

    public static void requireAddress(String field, String value) {
        if (value == null || containsLineBreak(value)) {
            throw new EmailDeliveryException("Email " + field + " is invalid");
        }
        String trimmed = value.trim();
        if (trimmed.isEmpty()
                || trimmed.length() > MAX_ADDRESS_LENGTH
                || trimmed.contains(" ")
                || trimmed.contains(",")
                || trimmed.contains(";")
                || trimmed.contains("<")
                || trimmed.contains(">")
                || trimmed.indexOf('@') <= 0
                || trimmed.indexOf('@') != trimmed.lastIndexOf('@')) {
            throw new EmailDeliveryException("Email " + field + " is invalid");
        }
    }

    public static void requireDisplayName(String value) {
        if (!StringUtils.hasText(value)) {
            return;
        }
        if (value.length() > MAX_DISPLAY_NAME_LENGTH || containsLineBreak(value)) {
            throw new EmailDeliveryException("Email fromName is invalid");
        }
    }

    public static void requireNoLineBreaks(String field, String value) {
        if (containsLineBreak(value)) {
            throw new EmailDeliveryException("Email " + field + " must not contain line breaks");
        }
    }

    public static void requireHeaders(Map<String, String> headers) {
        if (headers == null) {
            return;
        }
        for (var header : headers.entrySet()) {
            String name = header.getKey();
            String value = header.getValue();
            if (!StringUtils.hasText(name) || value == null) {
                continue;
            }
            if (name.length() > MAX_HEADER_NAME_LENGTH
                    || name.indexOf(':') >= 0
                    || containsLineBreak(name)) {
                throw new EmailDeliveryException("Email header name is invalid");
            }
            if (value.length() > MAX_HEADER_VALUE_LENGTH || containsLineBreak(value)) {
                throw new EmailDeliveryException("Email header value is invalid");
            }
        }
    }

    public static boolean containsLineBreak(String value) {
        return value != null && (value.indexOf('\r') >= 0 || value.indexOf('\n') >= 0);
    }
}
