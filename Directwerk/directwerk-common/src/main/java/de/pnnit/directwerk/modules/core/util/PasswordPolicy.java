package de.pnnit.directwerk.modules.core.util;

import java.nio.charset.StandardCharsets;
import org.springframework.util.StringUtils;

public final class PasswordPolicy {

    public static final int MIN_LENGTH = 8;
    /** bcrypt hashes at most 72 bytes; Spring Security 7 rejects longer input instead of truncating. */
    public static final int MAX_BYTES = 72;

    private PasswordPolicy() {
    }

    public static void validate(String password) {
        if (!StringUtils.hasText(password)
                || password.length() < MIN_LENGTH
                || password.getBytes(StandardCharsets.UTF_8).length > MAX_BYTES) {
            throw new IllegalArgumentException("Password must be at least 8 characters and at most 72 bytes");
        }
    }
}
