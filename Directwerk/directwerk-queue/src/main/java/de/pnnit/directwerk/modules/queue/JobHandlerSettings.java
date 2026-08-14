package de.pnnit.directwerk.modules.queue;

/**
 * Optional per-queue overrides. {@code null} fields fall back to global {@code directwerk.queue.*} settings.
 */
public record JobHandlerSettings(
        Long leaseSeconds,
        Long retryDelaySeconds,
        Integer defaultMaxAttempts
) {
    public JobHandlerSettings {
        if (leaseSeconds != null && leaseSeconds <= 0) {
            throw new IllegalArgumentException("leaseSeconds must be positive");
        }
        if (retryDelaySeconds != null && retryDelaySeconds <= 0) {
            throw new IllegalArgumentException("retryDelaySeconds must be positive");
        }
        if (defaultMaxAttempts != null && (defaultMaxAttempts < 1 || defaultMaxAttempts > 100)) {
            throw new IllegalArgumentException("defaultMaxAttempts must be within 1..100");
        }
    }

    public static JobHandlerSettings defaults() {
        return new JobHandlerSettings(null, null, null);
    }
}
