package de.pnnit.directwerk.modules.core.util;

import java.util.Locale;
import org.springframework.util.StringUtils;

public final class EmailNormalizer {

    public static final int MAX_EMAIL_LENGTH = 255;

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
}
