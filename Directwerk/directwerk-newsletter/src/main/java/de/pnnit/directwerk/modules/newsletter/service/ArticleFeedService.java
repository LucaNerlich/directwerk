package de.pnnit.directwerk.modules.newsletter.service;

import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.core.repository.UserRepository;
import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import de.pnnit.directwerk.modules.core.service.ModuleNotEnabledException;
import de.pnnit.directwerk.modules.core.util.FeedTokenGenerator;
import de.pnnit.directwerk.modules.digital.entity.Category;
import de.pnnit.directwerk.modules.digital.exception.CategoryNotFoundException;
import de.pnnit.directwerk.modules.digital.exception.StorageNotConfiguredException;
import de.pnnit.directwerk.modules.digital.service.CategoryService;
import de.pnnit.directwerk.modules.newsletter.access.ArticleFeedAccess;
import de.pnnit.directwerk.modules.newsletter.entity.Article;
import de.pnnit.directwerk.modules.newsletter.exception.ArticleFeedBuilderException;
import de.pnnit.directwerk.modules.newsletter.feed.ArticleFeed;
import de.pnnit.directwerk.modules.newsletter.feed.ArticleFeedCategoryMatcher;
import de.pnnit.directwerk.modules.newsletter.feed.ArticleFeedNotFoundException;
import de.pnnit.directwerk.modules.newsletter.feed.ArticleFeedRepository;
import de.pnnit.directwerk.modules.newsletter.ArticleFeedBuilderModule;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.hibernate.exception.ConstraintViolationException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ArticleFeedService {

    public static final int MAX_CUSTOM_FEEDS_PER_USER = 5;
    public static final int MAX_TITLE_LENGTH = 80;
    public static final int PREVIEW_SAMPLE_SIZE = 5;

    private final ArticleFeedRepository articleFeedRepository;
    private final TenantRepository tenantRepository;
    private final UserRepository userRepository;
    private final CategoryService categoryService;
    private final ArticleFeedAccess articleFeedAccess;
    private final FeedTokenGenerator feedTokenGenerator;
    private final ModuleGateService moduleGateService;
    private final ArticleRssFeedSnapshotService articleRssFeedSnapshotService;
    private final ArticleRssFeedRefreshScheduler articleRssFeedRefreshScheduler;

    @Transactional(readOnly = true)
    public ArticleFeed requireFeedByToken(String feedToken) {
        return articleFeedRepository.findByFeedToken(feedToken)
                .orElseThrow(ArticleFeedNotFoundException::new);
    }

    /**
     * Delivery-time gate for token-authenticated feeds: token must resolve, belong to the
     * Host tenant and be enabled. Custom feeds additionally require ARTICLE_FEED_BUILDER —
     * translated to not-found so readers never see an API error for a disabled feature.
     */
    @Transactional(readOnly = true)
    public ArticleFeed requireDeliverableFeed(Long tenantId, String feedToken) {
        ArticleFeed feed = requireFeedByToken(feedToken);
        if (!tenantId.equals(feed.getTenant().getId()) || !feed.isEnabled()) {
            throw new ArticleFeedNotFoundException();
        }
        if (!feed.isDefaultFeed()) {
            try {
                moduleGateService.requireModule(ArticleFeedBuilderModule.KEY);
            } catch (ModuleNotEnabledException ex) {
                throw new ArticleFeedNotFoundException();
            }
        }
        return feed;
    }

    @Transactional(readOnly = true)
    public List<ArticleFeed> listFeeds(Long tenantId, Long userId) {
        return articleFeedRepository.findByTenantIdAndUserIdOrderByDefaultFeedDescIdAsc(tenantId, userId);
    }

    @Transactional(readOnly = true)
    public List<ArticleFeed> listTenantFeeds(Long tenantId) {
        return articleFeedRepository.findByTenantIdOrderByIdAsc(tenantId);
    }

    @Transactional(readOnly = true)
    public boolean hasDefaultFeed(Long tenantId, Long userId) {
        return articleFeedRepository.findByTenantIdAndUserIdAndDefaultFeedTrue(tenantId, userId).isPresent();
    }

    @Transactional
    public ArticleFeed ensureDefaultFeed(Long tenantId, Long userId) {
        return articleFeedRepository.findByTenantIdAndUserIdAndDefaultFeedTrue(tenantId, userId)
                .orElseGet(() -> createDefaultFeed(tenantId, userId));
    }

    @Transactional
    public ArticleFeed rotateDefaultFeedToken(Long tenantId, Long userId) {
        ArticleFeed feed = ensureDefaultFeed(tenantId, userId);
        return rotateToken(feed);
    }

    @Transactional
    public ArticleFeed rotateOwnedFeedToken(Long tenantId, Long userId, Long feedId) {
        return rotateToken(requireOwnedFeed(tenantId, userId, feedId));
    }

    @Transactional(readOnly = true)
    public ArticleFeed requireFeed(Long tenantId, Long feedId) {
        return articleFeedRepository.findByIdAndTenantId(feedId, tenantId)
                .orElseThrow(ArticleFeedNotFoundException::new);
    }

    @Transactional
    public ArticleFeed setFeedEnabled(Long tenantId, Long feedId, boolean enabled) {
        return persistEnabled(requireFeed(tenantId, feedId), enabled);
    }

    @Transactional
    public ArticleFeed setDefaultFeedEnabled(Long tenantId, Long userId, boolean enabled) {
        return persistEnabled(ensureDefaultFeed(tenantId, userId), enabled);
    }

    @Transactional
    public ArticleFeed setOwnedFeedEnabled(Long tenantId, Long userId, Long feedId, boolean enabled) {
        return persistEnabled(requireOwnedFeed(tenantId, userId, feedId), enabled);
    }

    @Transactional
    public ArticleFeed createCustomFeed(Long tenantId, Long userId, String rawTitle, Collection<Long> categoryIds) {
        ensureDefaultFeed(tenantId, userId);

        // Acquire lock on user's default feed to serialize concurrent creates
        articleFeedRepository.findWithLockByTenantIdAndUserIdAndDefaultFeedTrue(tenantId, userId)
                .orElseThrow(() -> new IllegalStateException("Default feed not found after ensureDefaultFeed"));

        if (articleFeedRepository.countByTenantIdAndUserIdAndDefaultFeedFalse(tenantId, userId)
                >= MAX_CUSTOM_FEEDS_PER_USER) {
            throw ArticleFeedBuilderException.conflict(
                    "FEED_LIMIT_REACHED",
                    "At most " + MAX_CUSTOM_FEEDS_PER_USER + " custom feeds are allowed"
            );
        }
        String title = normalizeTitle(rawTitle);
        if (articleFeedRepository.existsByTenantIdAndUserIdAndDefaultFeedFalseAndTitleIgnoreCase(
                tenantId, userId, title
        )) {
            throw ArticleFeedBuilderException.conflict("FEED_TITLE_DUPLICATE", "A custom feed with this title already exists");
        }

        Tenant tenant = tenantRepository.getReferenceById(tenantId);
        ArticleFeed feed = new ArticleFeed();
        feed.setTenant(tenant);
        feed.setUser(userRepository.getReferenceById(userId));
        feed.setTitle(title);
        feed.setDefaultFeed(false);
        feed.setEnabled(true);
        feed.setFeedToken(generateUniqueToken());
        feed.getCategories().addAll(resolveActiveCategories(tenantId, categoryIds));

        try {
            ArticleFeed saved = articleFeedRepository.save(feed);
            articleRssFeedRefreshScheduler.requestRefreshAfterCommit(tenantId);
            return saved;
        } catch (DataIntegrityViolationException ex) {
            if (ex.getCause() instanceof ConstraintViolationException cve) {
                String constraintName = cve.getConstraintName();
                if (constraintName != null && constraintName.contains("uq_article_feeds_custom_title")) {
                    throw ArticleFeedBuilderException.conflict("FEED_TITLE_DUPLICATE", "A custom feed with this title already exists");
                }
            }
            throw ex;
        }
    }

    @Transactional
    public ArticleFeed updateCustomFeed(
            Long tenantId,
            Long userId,
            Long feedId,
            String rawTitle,
            Collection<Long> categoryIds
    ) {
        ArticleFeed feed = requireOwnedCustomFeed(
                tenantId,
                userId,
                feedId,
                "DEFAULT_FEED_NOT_FILTERABLE",
                "The default private feed cannot be filtered"
        );
        if (rawTitle == null && categoryIds == null) {
            throw ArticleFeedBuilderException.badRequest("FEED_TITLE_INVALID", "title or categoryIds is required");
        }
        if (rawTitle != null) {
            String title = normalizeTitle(rawTitle);
            if (articleFeedRepository.existsByTenantIdAndUserIdAndDefaultFeedFalseAndIdNotAndTitleIgnoreCase(
                    tenantId, userId, feedId, title
            )) {
                throw ArticleFeedBuilderException.conflict(
                        "FEED_TITLE_DUPLICATE",
                        "A custom feed with this title already exists"
                );
            }
            feed.setTitle(title);
        }
        if (categoryIds != null) {
            feed.getCategories().clear();
            feed.getCategories().addAll(resolveActiveCategories(tenantId, categoryIds));
        }
        ArticleFeed saved = articleFeedRepository.save(feed);
        articleRssFeedRefreshScheduler.requestRefreshAfterCommit(tenantId);
        return saved;
    }

    @Transactional
    public ArticleFeed deleteCustomFeed(Long tenantId, Long userId, Long feedId) {
        ArticleFeed feed = requireOwnedCustomFeed(
                tenantId,
                userId,
                feedId,
                "DEFAULT_FEED_NOT_DELETABLE",
                "The default private feed cannot be deleted"
        );
        withdrawSnapshot(feed);
        articleFeedRepository.delete(feed);
        articleRssFeedRefreshScheduler.requestRefreshAfterCommit(tenantId);
        return feed;
    }

    @Transactional(readOnly = true)
    public FeedPreview preview(Long tenantId, Long userId, Collection<Long> categoryIds) {
        Set<Category> categories = resolveActiveCategories(tenantId, categoryIds);
        Set<Long> categoryIdSet = new LinkedHashSet<>();
        categories.forEach(category -> categoryIdSet.add(category.getId()));
        return previewMatching(tenantId, userId, categoryIdSet);
    }

    @Transactional(readOnly = true)
    public FeedPreview previewOwnedFeed(Long tenantId, Long userId, Long feedId) {
        ArticleFeed feed = requireOwnedCustomFeed(
                tenantId,
                userId,
                feedId,
                "DEFAULT_FEED_NOT_FILTERABLE",
                "The default private feed cannot be previewed as a custom feed"
        );
        return previewMatching(tenantId, userId, ArticleFeedCategoryMatcher.selectedActiveCategoryIds(feed));
    }

    public record FeedPreview(int articleCount, List<String> sampleTitles) {
    }

    private FeedPreview previewMatching(Long tenantId, Long userId, Set<Long> activeCategoryIds) {
        List<Article> matches = articleFeedAccess.listEntitledArticlesForCategories(tenantId, userId, activeCategoryIds);
        List<String> samples = matches.stream()
                .limit(PREVIEW_SAMPLE_SIZE)
                .map(Article::getTitle)
                .toList();
        return new FeedPreview(matches.size(), samples);
    }

    private ArticleFeed requireOwnedFeed(Long tenantId, Long userId, Long feedId) {
        return articleFeedRepository.findByIdAndTenantIdAndUserId(feedId, tenantId, userId)
                .orElseThrow(ArticleFeedNotFoundException::new);
    }

    private ArticleFeed requireOwnedCustomFeed(
            Long tenantId,
            Long userId,
            Long feedId,
            String defaultFeedCode,
            String defaultFeedMessage
    ) {
        ArticleFeed feed = requireOwnedFeed(tenantId, userId, feedId);
        if (feed.isDefaultFeed()) {
            throw ArticleFeedBuilderException.conflict(defaultFeedCode, defaultFeedMessage);
        }
        return feed;
    }

    private ArticleFeed persistEnabled(ArticleFeed feed, boolean enabled) {
        feed.setEnabled(enabled);
        ArticleFeed saved = articleFeedRepository.save(feed);
        articleRssFeedRefreshScheduler.requestRefreshAfterCommit(saved.getTenant().getId());
        return saved;
    }

    private ArticleFeed rotateToken(ArticleFeed feed) {
        feed.setFeedToken(generateUniqueToken());
        ArticleFeed saved = articleFeedRepository.save(feed);
        articleRssFeedRefreshScheduler.requestRefreshAfterCommit(saved.getTenant().getId());
        return saved;
    }

    private Set<Category> resolveActiveCategories(Long tenantId, Collection<Long> categoryIds) {
        if (categoryIds == null || categoryIds.isEmpty()) {
            throw ArticleFeedBuilderException.badRequest("FEED_CATEGORIES_REQUIRED", "Select at least one category");
        }
        LinkedHashSet<Long> distinctIds = new LinkedHashSet<>();
        for (Long categoryId : categoryIds) {
            if (categoryId != null) {
                distinctIds.add(categoryId);
            }
        }
        if (distinctIds.isEmpty()) {
            throw ArticleFeedBuilderException.badRequest("FEED_CATEGORIES_REQUIRED", "Select at least one category");
        }
        try {
            return categoryService.resolveActiveCategories(tenantId, distinctIds, categoryId -> {
                throw ArticleFeedBuilderException.badRequest("FEED_CATEGORY_INVALID", "Category is inactive: " + categoryId);
            });
        } catch (CategoryNotFoundException ex) {
            throw ArticleFeedBuilderException.badRequest("FEED_CATEGORY_INVALID", ex.getMessage());
        }
    }

    private static String normalizeTitle(String rawTitle) {
        if (rawTitle == null || rawTitle.isBlank()) {
            throw ArticleFeedBuilderException.badRequest("FEED_TITLE_INVALID", "Feed title is required");
        }
        String title = rawTitle.trim();
        if (title.length() > MAX_TITLE_LENGTH) {
            throw ArticleFeedBuilderException.badRequest(
                    "FEED_TITLE_INVALID",
                    "Feed title must be at most " + MAX_TITLE_LENGTH + " characters"
            );
        }
        return title;
    }

    private void withdrawSnapshot(ArticleFeed feed) {
        try {
            articleRssFeedSnapshotService.withdrawPrivateFeed(feed.getTenant(), feed.getId());
        } catch (StorageNotConfiguredException | IllegalStateException ignored) {
            // Local/dev without object storage still deletes the row.
        }
    }

    private ArticleFeed createDefaultFeed(Long tenantId, Long userId) {
        Tenant tenant = tenantRepository.getReferenceById(tenantId);

        ArticleFeed feed = new ArticleFeed();
        feed.setTenant(tenant);
        feed.setUser(userRepository.getReferenceById(userId));
        feed.setTitle(tenant.getName() + " Private Article Feed");
        feed.setDefaultFeed(true);
        feed.setFeedToken(generateUniqueToken());
        try {
            ArticleFeed saved = articleFeedRepository.save(feed);
            articleRssFeedRefreshScheduler.requestRefreshAfterCommit(tenantId);
            return saved;
        } catch (DataIntegrityViolationException ex) {
            if (ex.getCause() instanceof ConstraintViolationException cve
                    && cve.getConstraintName() != null
                    && cve.getConstraintName().contains("uq_article_feeds_default")) {
                // Concurrent first-time ensureDefaultFeed calls can both attempt the insert;
                // the loser just reads back the row the winner committed.
                return articleFeedRepository.findByTenantIdAndUserIdAndDefaultFeedTrue(tenantId, userId)
                        .orElseThrow(() -> ex);
            }
            throw ex;
        }
    }

    private String generateUniqueToken() {
        String token;
        do {
            token = feedTokenGenerator.generate();
        } while (articleFeedRepository.existsByFeedToken(token));
        return token;
    }
}
