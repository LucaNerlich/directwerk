package de.pnnit.directwerk.modules.core.util;

import java.util.Locale;
import java.util.regex.Pattern;

public final class TenantHostname {

    private static final int MAX_LENGTH = 253;
    private static final Pattern HOSTNAME = Pattern.compile(
            "^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))*$"
    );

    private TenantHostname() {
    }

    public static String normalize(String host) {
        if (host == null) {
            throw new IllegalArgumentException("Host is required");
        }

        String normalized = host.trim().toLowerCase(Locale.ROOT);
        if (normalized.isEmpty() || normalized.length() > MAX_LENGTH) {
            throw new IllegalArgumentException("Host must be between 1 and 253 characters");
        }
        if (normalized.startsWith(".") || normalized.endsWith(".") || normalized.contains("..")) {
            throw new IllegalArgumentException("Host format is invalid");
        }
        if (!HOSTNAME.matcher(normalized).matches()) {
            throw new IllegalArgumentException("Host format is invalid");
        }
        return normalized;
    }
}
