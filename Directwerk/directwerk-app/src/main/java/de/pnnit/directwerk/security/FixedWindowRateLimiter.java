package de.pnnit.directwerk.security;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import java.time.Duration;
import java.time.Instant;

/** Per-minute fixed-window request counter shared by the auth and billing rate-limit filters. */
final class FixedWindowRateLimiter {

    private final Cache<String, WindowCounter> counters = Caffeine.newBuilder()
            .expireAfterAccess(Duration.ofMinutes(2))
            .maximumSize(10000)
            .build();

    boolean isRateLimited(String key, int limitPerMinute) {
        long windowStart = Instant.now().getEpochSecond() / 60;
        WindowCounter counter = counters.asMap().compute(key, (existingKey, existing) -> {
            if (existing == null || existing.windowStart() != windowStart) {
                return new WindowCounter(windowStart, 1);
            }
            return new WindowCounter(windowStart, existing.count() + 1);
        });
        return counter.count() > limitPerMinute;
    }

    private record WindowCounter(long windowStart, int count) {
    }
}
