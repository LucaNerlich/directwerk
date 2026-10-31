package de.pnnit.directwerk.modules.core.util;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class OffsetLimitPageRequestTest {

    @Test
    void nonMultipleOffsetIsRowsSkippedNotFlooredPage() {
        OffsetLimitPageRequest page = OffsetLimitPageRequest.of(100, 50);

        assertThat(page.getPageSize()).isEqualTo(100);
        assertThat(page.getOffset()).isEqualTo(50);
        // PageRequest.of(50/100, 100) would report offset 0 — that is the bug this replaces.
        assertThat(page.getPageNumber()).isEqualTo(0);
    }

    @Test
    void maxLimitCapPreservesOffset() {
        OffsetLimitPageRequest page = OffsetLimitPageRequest.of(500, 75, 100);

        assertThat(page.getPageSize()).isEqualTo(100);
        assertThat(page.getOffset()).isEqualTo(75);
    }

    @Test
    void negativeInputsAreClamped() {
        OffsetLimitPageRequest page = OffsetLimitPageRequest.of(0, -10);

        assertThat(page.getPageSize()).isEqualTo(1);
        assertThat(page.getOffset()).isZero();
    }
}
