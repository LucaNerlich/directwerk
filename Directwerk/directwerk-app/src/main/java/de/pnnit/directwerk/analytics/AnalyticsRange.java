package de.pnnit.directwerk.analytics;

import java.util.Optional;

/**
 * The one definition of the dashboard ranges: window length and Umami bucketing.
 */
public enum AnalyticsRange {
    SEVEN_DAYS("7d", 7, "day"),
    THIRTY_DAYS("30d", 30, "day"),
    TWELVE_MONTHS("12m", 365, "month");

    private final String param;
    private final int days;
    private final String unit;

    AnalyticsRange(String param, int days, String unit) {
        this.param = param;
        this.days = days;
        this.unit = unit;
    }

    public String param() {
        return param;
    }

    public int days() {
        return days;
    }

    public String unit() {
        return unit;
    }

    public static Optional<AnalyticsRange> fromParam(String param) {
        for (AnalyticsRange range : values()) {
            if (range.param.equals(param)) {
                return Optional.of(range);
            }
        }
        return Optional.empty();
    }
}
