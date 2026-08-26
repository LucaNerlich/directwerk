package de.pnnit.directwerk.modules.podcast.feed;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.HashSet;
import java.util.Set;
import org.junit.jupiter.api.Test;

/**
 * The feed token is the only secret guarding private RSS feeds — its entropy, alphabet and
 * length are security invariants and are pinned here.
 */
class FeedTokenGeneratorTest {

    private final FeedTokenGenerator generator = new FeedTokenGenerator();

    @Test
    void tokensAreThirtyTwoBase64UrlCharactersFromTwentyFourBytes() {
        String token = generator.generate();

        // 24 bytes → ceil(24 * 4 / 3) = 32 chars, unpadded
        assertThat(token).hasSize(32);
        assertThat(token).matches("^[A-Za-z0-9_-]+$").doesNotContain("=", "+", "/");
    }

    @Test
    void generationIsUniqueAcrossManyDraws() {
        Set<String> seen = new HashSet<>();
        for (int i = 0; i < 10_000; i++) {
            seen.add(generator.generate());
        }
        assertThat(seen).hasSize(10_000);
    }

    @Test
    void distinctTokensHaveDistinctLeadingBitsSoEntropyIsNotTriviallyCollapsed() {
        // crude entropy smoke test: at least 16 distinct first characters over 64 draws
        Set<Character> leading = new HashSet<>();
        for (int i = 0; i < 64; i++) {
            leading.add(generator.generate().charAt(0));
        }
        assertThat(leading.size()).isGreaterThanOrEqualTo(16);
    }
}
