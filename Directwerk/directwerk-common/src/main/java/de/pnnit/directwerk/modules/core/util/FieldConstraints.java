package de.pnnit.directwerk.modules.core.util;

public final class FieldConstraints {

    private FieldConstraints() {
    }

    public static Integer requirePositive(Integer value, String field) {
        if (value != null && value <= 0) {
            throw new IllegalArgumentException(field + " must be positive");
        }
        return value;
    }

    public static Integer requireNonNegative(Integer value, String field) {
        if (value != null && value < 0) {
            throw new IllegalArgumentException(field + " must be non-negative");
        }
        return value;
    }
}
