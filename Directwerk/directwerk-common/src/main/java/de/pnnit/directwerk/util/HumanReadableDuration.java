package de.pnnit.directwerk.util;

import java.time.Duration;

/**
 * Formats a duration for human-readable email copy (e.g. {@code 1 hour}, {@code 24 hours}).
 */
public final class HumanReadableDuration {

    private HumanReadableDuration() {
    }

    public static String format(Duration duration) {
        if (duration == null || duration.isZero() || duration.isNegative()) {
            throw new IllegalArgumentException("Duration must be positive");
        }
        long totalMinutes = duration.toMinutes();
        if (totalMinutes < 60) {
            long minutes = Math.max(1, totalMinutes);
            return minutes == 1 ? "1 minute" : minutes + " minutes";
        }
        long totalHours = duration.toHours();
        if (totalHours < 48) {
            return totalHours == 1 ? "1 hour" : totalHours + " hours";
        }
        long totalDays = duration.toDays();
        return totalDays == 1 ? "1 day" : totalDays + " days";
    }
}
