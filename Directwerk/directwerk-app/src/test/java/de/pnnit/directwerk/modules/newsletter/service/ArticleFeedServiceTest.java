package de.pnnit.directwerk.modules.newsletter.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.entity.User;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.core.repository.UserRepository;
import de.pnnit.directwerk.modules.digital.entity.Category;
import de.pnnit.directwerk.modules.digital.service.CategoryService;
import de.pnnit.directwerk.modules.newsletter.access.ArticleFeedAccess;
import de.pnnit.directwerk.modules.newsletter.exception.ArticleFeedBuilderException;
import de.pnnit.directwerk.modules.newsletter.feed.ArticleFeed;
import de.pnnit.directwerk.modules.newsletter.feed.ArticleFeedNotFoundException;
import de.pnnit.directwerk.modules.newsletter.feed.ArticleFeedRepository;
import de.pnnit.directwerk.modules.newsletter.job.ArticleRssFeedRefreshJobProducer;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.hibernate.exception.ConstraintViolationException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

@ExtendWith(MockitoExtension.class)
@org.mockito.junit.jupiter.MockitoSettings(strictness = org.mockito.quality.Strictness.LENIENT)
class ArticleFeedServiceTest {

    @BeforeEach
    void stubTokenGeneration() {
        org.mockito.Mockito.lenient().doReturn("tok-default")
                .when(feedTokenGenerator).generate();
    }

    @Mock
    private ArticleFeedRepository articleFeedRepository;

    @Mock
    private TenantRepository tenantRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private CategoryService categoryService;

    @Mock
    private ArticleFeedAccess articleFeedAccess;

    @Mock
    private ArticleRssFeedSnapshotService articleRssFeedSnapshotService;

    @Mock
    private ArticleRssFeedRefreshJobProducer articleRssFeedRefreshScheduler;

    @Mock
    private de.pnnit.directwerk.modules.core.util.FeedTokenGenerator feedTokenGenerator;

    @Mock
    private de.pnnit.directwerk.modules.core.service.ModuleGateService moduleGateService;

    @InjectMocks
    private ArticleFeedService articleFeedService;

    @Test
    void requireFeedReturnsTenantMatchedFeed() {
        ArticleFeed feed = feed(10L, 1L);
        when(articleFeedRepository.findByIdAndTenantId(1L, 10L)).thenReturn(Optional.of(feed));

        assertThat(articleFeedService.requireFeed(10L, 1L)).isSameAs(feed);
    }

    @Test
    void requireFeedRejectsTenantMismatch() {
        when(articleFeedRepository.findByIdAndTenantId(1L, 99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> articleFeedService.requireFeed(99L, 1L))
                .isInstanceOf(ArticleFeedNotFoundException.class);
    }

    @Test
    void setFeedEnabledPersistsToggleForTenantScopedFeed() {
        ArticleFeed feed = feed(10L, 1L);
        when(articleFeedRepository.findByIdAndTenantId(1L, 10L)).thenReturn(Optional.of(feed));
        when(articleFeedRepository.save(feed)).thenReturn(feed);

        ArticleFeed updated = articleFeedService.setFeedEnabled(10L, 1L, false);

        assertThat(updated.isEnabled()).isFalse();
        ArgumentCaptor<ArticleFeed> captor = ArgumentCaptor.forClass(ArticleFeed.class);
        verify(articleFeedRepository).save(captor.capture());
        assertThat(captor.getValue().isEnabled()).isFalse();
        assertThat(captor.getValue().getTenant().getId()).isEqualTo(10L);
        verify(articleRssFeedRefreshScheduler).requestRefreshAfterCommit(10L);
    }

    @Test
    void setFeedEnabledRejectsTenantMismatch() {
        when(articleFeedRepository.findByIdAndTenantId(1L, 99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> articleFeedService.setFeedEnabled(99L, 1L, false))
                .isInstanceOf(ArticleFeedNotFoundException.class);
        verify(articleFeedRepository, never()).save(any());
    }

    @Test
    void setDefaultFeedEnabledUsesEnsureDefaultFeedAndPersists() {
        ArticleFeed feed = feed(10L, 1L);
        when(articleFeedRepository.findByTenantIdAndUserIdAndDefaultFeedTrue(10L, 99L))
                .thenReturn(Optional.of(feed));
        when(articleFeedRepository.save(feed)).thenReturn(feed);

        ArticleFeed updated = articleFeedService.setDefaultFeedEnabled(10L, 99L, false);

        assertThat(updated.isEnabled()).isFalse();
        verify(articleFeedRepository).findByTenantIdAndUserIdAndDefaultFeedTrue(10L, 99L);
        verify(articleFeedRepository).save(feed);
        verify(tenantRepository, never()).getReferenceById(any());
    }

    @Test
    void ensureDefaultFeedRecoversWhenAConcurrentCallAlreadyInsertedTheDefaultFeed() {
        ArticleFeed winner = feed(10L, 1L);
        when(articleFeedRepository.findByTenantIdAndUserIdAndDefaultFeedTrue(10L, 99L))
                .thenReturn(Optional.empty())
                .thenReturn(Optional.of(winner));
        when(tenantRepository.getReferenceById(10L)).thenReturn(winner.getTenant());
        when(userRepository.getReferenceById(99L)).thenReturn(winner.getUser());
        when(articleFeedRepository.save(any(ArticleFeed.class))).thenThrow(
                new DataIntegrityViolationException(
                        "duplicate default feed",
                        new ConstraintViolationException(
                                "duplicate key value violates unique constraint",
                                new SQLException("duplicate key"),
                                "uq_article_feeds_default"
                        )
                )
        );

        ArticleFeed result = articleFeedService.ensureDefaultFeed(10L, 99L);

        assertThat(result).isSameAs(winner);
        verify(articleRssFeedRefreshScheduler, never()).requestRefreshAfterCommit(any());
    }

    @Test
    void createCustomFeedPersistsCategoriesAndEnqueuesRefresh() {
        ArticleFeed defaultFeed = feed(10L, 1L);
        when(articleFeedRepository.findByTenantIdAndUserIdAndDefaultFeedTrue(10L, 99L))
                .thenReturn(Optional.of(defaultFeed));
        when(articleFeedRepository.findWithLockByTenantIdAndUserIdAndDefaultFeedTrue(10L, 99L))
                .thenReturn(Optional.of(defaultFeed));
        when(articleFeedRepository.countByTenantIdAndUserIdAndDefaultFeedFalse(10L, 99L)).thenReturn(0L);
        when(articleFeedRepository.existsByTenantIdAndUserIdAndDefaultFeedFalseAndTitleIgnoreCase(
                10L, 99L, "Nur Reportagen"
        )).thenReturn(false);
        when(tenantRepository.getReferenceById(10L)).thenReturn(defaultFeed.getTenant());
        when(userRepository.getReferenceById(99L)).thenReturn(defaultFeed.getUser());
        when(categoryService.resolveActiveCategories(eq(10L), any(), any()))
                .thenReturn(Set.of(category(3L)));
        when(articleFeedRepository.existsByFeedToken(org.mockito.ArgumentMatchers.anyString())).thenReturn(false);
        when(articleFeedRepository.save(any(ArticleFeed.class))).thenAnswer(invocation -> {
            ArticleFeed saved = invocation.getArgument(0);
            saved.setId(12L);
            return saved;
        });

        ArticleFeed created = articleFeedService.createCustomFeed(10L, 99L, "  Nur Reportagen  ", List.of(3L));

        assertThat(created.isDefaultFeed()).isFalse();
        assertThat(created.getTitle()).isEqualTo("Nur Reportagen");
        assertThat(created.getCategories()).extracting(Category::getId).containsExactly(3L);
        verify(articleRssFeedRefreshScheduler).requestRefreshAfterCommit(10L);
    }

    @Test
    void createCustomFeedRejectsWhenLimitReached() {
        ArticleFeed defaultFeed = feed(10L, 1L);
        when(articleFeedRepository.findByTenantIdAndUserIdAndDefaultFeedTrue(10L, 99L))
                .thenReturn(Optional.of(defaultFeed));
        when(articleFeedRepository.findWithLockByTenantIdAndUserIdAndDefaultFeedTrue(10L, 99L))
                .thenReturn(Optional.of(defaultFeed));
        when(articleFeedRepository.countByTenantIdAndUserIdAndDefaultFeedFalse(10L, 99L)).thenReturn(5L);

        assertThatThrownBy(() -> articleFeedService.createCustomFeed(10L, 99L, "Extra", List.of(3L)))
                .isInstanceOf(ArticleFeedBuilderException.class)
                .extracting(ex -> ((ArticleFeedBuilderException) ex).getCode())
                .isEqualTo("FEED_LIMIT_REACHED");
        verify(articleFeedRepository, never()).save(any());
    }

    @Test
    void createCustomFeedRejectsEmptyCategories() {
        ArticleFeed defaultFeed = feed(10L, 1L);
        when(articleFeedRepository.findByTenantIdAndUserIdAndDefaultFeedTrue(10L, 99L))
                .thenReturn(Optional.of(defaultFeed));
        when(articleFeedRepository.findWithLockByTenantIdAndUserIdAndDefaultFeedTrue(10L, 99L))
                .thenReturn(Optional.of(defaultFeed));
        when(articleFeedRepository.countByTenantIdAndUserIdAndDefaultFeedFalse(10L, 99L)).thenReturn(0L);
        when(articleFeedRepository.existsByTenantIdAndUserIdAndDefaultFeedFalseAndTitleIgnoreCase(
                10L, 99L, "Leer"
        )).thenReturn(false);

        assertThatThrownBy(() -> articleFeedService.createCustomFeed(10L, 99L, "Leer", List.of()))
                .isInstanceOf(ArticleFeedBuilderException.class)
                .extracting(ex -> ((ArticleFeedBuilderException) ex).getCode())
                .isEqualTo("FEED_CATEGORIES_REQUIRED");
        verify(articleFeedRepository, never()).save(any());
    }

    @Test
    void deleteCustomFeedRejectsDefaultFeed() {
        ArticleFeed defaultFeed = feed(10L, 1L);
        when(articleFeedRepository.findByIdAndTenantIdAndUserId(1L, 10L, 99L))
                .thenReturn(Optional.of(defaultFeed));

        assertThatThrownBy(() -> articleFeedService.deleteCustomFeed(10L, 99L, 1L))
                .isInstanceOf(ArticleFeedBuilderException.class)
                .extracting(ex -> ((ArticleFeedBuilderException) ex).getCode())
                .isEqualTo("DEFAULT_FEED_NOT_DELETABLE");
        verify(articleFeedRepository, never()).delete(any());
    }

    @Test
    void deleteCustomFeedWithdrawsThenDeletes() {
        ArticleFeed custom = feed(10L, 12L);
        custom.setDefaultFeed(false);
        when(articleFeedRepository.findByIdAndTenantIdAndUserId(12L, 10L, 99L))
                .thenReturn(Optional.of(custom));

        articleFeedService.deleteCustomFeed(10L, 99L, 12L);

        verify(articleRssFeedSnapshotService).withdrawPrivateFeed(custom.getTenant(), 12L);
        verify(articleFeedRepository).delete(custom);
        verify(articleRssFeedRefreshScheduler).requestRefreshAfterCommit(10L);
    }

    private static <T> T eq(T value) {
        return org.mockito.ArgumentMatchers.eq(value);
    }

    private static Category category(Long id) {
        Category category = new Category();
        category.setId(id);
        category.setSlug("reportagen");
        category.setName("Reportagen");
        category.setActive(true);
        return category;
    }

    private static ArticleFeed feed(Long tenantId, Long feedId) {
        Tenant tenant = new Tenant();
        tenant.setId(tenantId);
        tenant.setSlug("alpha");
        tenant.setName("Alpha");

        User user = new User();
        user.setId(99L);

        ArticleFeed feed = new ArticleFeed();
        feed.setId(feedId);
        feed.setTenant(tenant);
        feed.setUser(user);
        feed.setTitle("Private");
        feed.setFeedToken("tok");
        feed.setDefaultFeed(true);
        feed.setEnabled(true);
        return feed;
    }
}
