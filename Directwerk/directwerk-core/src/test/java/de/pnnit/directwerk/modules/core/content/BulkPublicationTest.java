package de.pnnit.directwerk.modules.core.content;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class BulkPublicationTest {

    @Test
    void distinctIdsPreserveRequestOrder() {
        assertThat(BulkPublication.distinctIds(List.of(3L, 1L, 3L, 2L, 1L)))
                .containsExactly(3L, 1L, 2L);
    }

    @Test
    void applyRunsOncePerDistinctIdInRequestOrder() {
        List<Long> visited = new ArrayList<>();

        List<String> results = BulkPublication.apply(List.of(2L, 1L, 2L), id -> {
            visited.add(id);
            return "id-" + id;
        });

        assertThat(visited).containsExactly(2L, 1L);
        assertThat(results).containsExactly("id-2", "id-1");
    }
}
