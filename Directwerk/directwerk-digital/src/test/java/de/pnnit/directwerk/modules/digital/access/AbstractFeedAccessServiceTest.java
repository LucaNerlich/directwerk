package de.pnnit.directwerk.modules.digital.access;

import static org.assertj.core.api.Assertions.assertThat;

import de.pnnit.directwerk.modules.core.feed.AbstractFeed;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;

class AbstractFeedAccessServiceTest {

    @Test
    void listEntitledKeepsOnlyContentTheFeedFilterIncludes() {
        TestAccessService service = new TestAccessService(List.of("a", "b", "c"), Set.of("a", "b"));

        assertThat(service.listEntitled(1L, 2L, new TestFeed())).containsExactly("a", "b");
        assertThat(service.listEntitledForSelection(1L, 2L, Set.of(1L))).containsExactly("a");
    }

    @Test
    void hasAccessRequiresBothTheFeedFilterAndTheEntitlement() {
        TestAccessService service = new TestAccessService(List.of("a", "b"), Set.of("a", "b"));

        assertThat(service.hasAccess(1L, 2L, new TestFeed(), "a")).isTrue();
        assertThat(service.hasAccess(1L, 2L, new TestFeed(), "z")).isFalse();
    }

    private static final class TestAccessService extends AbstractFeedAccessService<String, TestFeed> {

        private final List<String> entitled;
        private final Set<String> filtered;

        private TestAccessService(List<String> entitled, Set<String> filtered) {
            this.entitled = entitled;
            this.filtered = filtered;
        }

        @Override
        protected List<String> entitledContent(Long tenantId, Long userId) {
            return entitled;
        }

        @Override
        protected boolean matchesFeed(TestFeed feed, String content) {
            return filtered.contains(content);
        }

        @Override
        protected boolean matchesSelection(String content, Set<Long> selectionIds) {
            return "a".equals(content);
        }

        @Override
        protected boolean hasContentAccess(Long tenantId, Long userId, String content) {
            return entitled.contains(content);
        }
    }

    private static final class TestFeed extends AbstractFeed {
    }
}
