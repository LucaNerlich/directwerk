package de.pnnit.directwerk.modules.core.util;

import java.util.regex.Pattern;

public final class UmamiWebsiteIdValidator {

    private static final Pattern PATTERN = Pattern.compile("^[a-zA-Z0-9-]{8,64}$");

    private UmamiWebsiteIdValidator() {
    }

    public static boolean isValid(String websiteId) {
        return websiteId != null && PATTERN.matcher(websiteId.trim()).matches();
    }

    public static String normalize(String websiteId) {
        if (websiteId == null) {
            return null;
        }
        String trimmed = websiteId.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
