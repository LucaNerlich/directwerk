package de.pnnit.directwerk.modules.core.util;

import java.util.Locale;
import java.util.regex.Pattern;
import org.springframework.util.StringUtils;

public final class EmailNormalizer {

    public static final int MAX_EMAIL_LENGTH = 255;

    private static final Pattern SIMPLE_EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");

    private EmailNormalizer() {
    }

    public static String normalize(String email) {
        if (!StringUtils.hasText(email)) {
            throw new IllegalArgumentException("Email is required");
        }
        String trimmed = email.trim();
        if (trimmed.length() > MAX_EMAIL_LENGTH) {
            throw new IllegalArgumentException("Email must be at most 255 characters");
        }
        return trimmed.toLowerCase(Locale.ROOT);
    }

    /**
     * Blank/null clears the stored address ({@code null}). Non-blank values are normalized
     * and must look like an email.
     */
    public static String normalizeOptional(String email) {
        if (!StringUtils.hasText(email)) {
            return null;
        }
        String normalized = normalize(email);
        if (!SIMPLE_EMAIL.matcher(normalized).matches()) {
            throw new IllegalArgumentException("Email must be a valid email address");
        }
        return normalized;
    }
}
