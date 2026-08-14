package de.pnnit.directwerk.modules.core.util;

import org.springframework.util.StringUtils;

public final class PasswordPolicy {

    public static final int MIN_LENGTH = 8;
    public static final int MAX_LENGTH = 128;

    private PasswordPolicy() {
    }

    public static void validate(String password) {
        if (!StringUtils.hasText(password) || password.length() < MIN_LENGTH || password.length() > MAX_LENGTH) {
            throw new IllegalArgumentException("Password must be between 8 and 128 characters");
        }
    }
}
