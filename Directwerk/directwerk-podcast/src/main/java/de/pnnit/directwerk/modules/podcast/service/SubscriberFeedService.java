package de.pnnit.directwerk.modules.podcast.service;

import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import de.pnnit.directwerk.modules.core.service.ModuleNotEnabledException;
import de.pnnit.directwerk.modules.podcast.FeedBuilderModule;
import de.pnnit.directwerk.modules.core.repository.UserRepository;
import de.pnnit.directwerk.modules.digital.exception.StorageNotConfiguredException;
import de.pnnit.directwerk.modules.podcast.entity.Episode;
import de.pnnit.directwerk.modules.podcast.entity.Format;
import de.pnnit.directwerk.modules.podcast.repository.FormatRepository;
import de.pnnit.directwerk.modules.podcast.feed.FeedBuilderException;
import de.pnnit.directwerk.modules.podcast.feed.FeedTokenGenerator;
import de.pnnit.directwerk.modules.podcast.feed.SubscriberFeed;
import de.pnnit.directwerk.modules.podcast.feed.SubscriberFeedFormatMatcher;
import de.pnnit.directwerk.modules.podcast.feed.SubscriberFeedNotFoundException;
import de.pnnit.directwerk.modules.podcast.feed.SubscriberFeedRepository;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
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
public class SubscriberFeedService {

    public static final int MAX_CUSTOM_FEEDS_PER_USER = 5;
    public static final int MAX_TITLE_LENGTH = 80;
    public static final int PREVIEW_SAMPLE_SIZE = 5;

    private final SubscriberFeedRepository subscriberFeedRepository;
    private final TenantRepository tenantRepository;
    private final UserRepository userRepository;
    private final FormatRepository formatRepository;
    private final SubscriberEpisodeService subscriberEpisodeService;
    private final FeedTokenGenerator feedTokenGenerator;
    private final ModuleGateService moduleGateService;
    private final RssFeedSnapshotService rssFeedSnapshotService;
    private final RssFeedRefreshScheduler rssFeedRefreshScheduler;

    @Transactional(readOnly = true)
    public SubscriberFeed requireFeedByToken(String feedToken) {
        return subscriberFeedRepository.findByFeedToken(feedToken)
                .orElseThrow(SubscriberFeedNotFoundException::new);
    }

    /**
     * Delivery-time gate for token-authenticated feeds: token must resolve, belong to the
     * Host tenant and be enabled. Custom feeds additionally require FEED_BUILDER — translated
     * to not-found so podcatchers never see an API error for a disabled feature.
     */
    @Transactional(readOnly = true)
    public SubscriberFeed requireDeliverableFeed(Long tenantId, String feedToken) {
        SubscriberFeed feed = requireFeedByToken(feedToken);
        if (!tenantId.equals(feed.getTenant().getId()) || !feed.isEnabled()) {
            throw new SubscriberFeedNotFoundException();
        }
        if (!feed.isDefaultFeed()) {
            try {
                moduleGateService.requireModule(FeedBuilderModule.KEY);
            } catch (ModuleNotEnabledException ex) {
                throw new SubscriberFeedNotFoundException();
            }
        }
        return feed;
    }

    @Transactional(readOnly = true)
    public List<SubscriberFeed> listFeeds(Long tenantId, Long userId) {
        return subscriberFeedRepository.findByTenantIdAndUserIdOrderByDefaultFeedDescIdAsc(tenantId, userId);
    }

    @Transactional(readOnly = true)
    public List<SubscriberFeed> listTenantFeeds(Long tenantId) {
        return subscriberFeedRepository.findByTenantIdOrderByIdAsc(tenantId);
    }

    @Transactional
    public SubscriberFeed ensureDefaultFeed(Long tenantId, Long userId) {
        return subscriberFeedRepository.findByTenantIdAndUserIdAndDefaultFeedTrue(tenantId, userId)
                .orElseGet(() -> createDefaultFeed(tenantId, userId));
    }

    @Transactional
    public SubscriberFeed rotateDefaultFeedToken(Long tenantId, Long userId) {
        SubscriberFeed feed = ensureDefaultFeed(tenantId, userId);
        return rotateToken(feed);
    }

    @Transactional
    public SubscriberFeed rotateOwnedFeedToken(Long tenantId, Long userId, Long feedId) {
        return rotateToken(requireOwnedFeed(tenantId, userId, feedId));
    }

    @Transactional(readOnly = true)
    public SubscriberFeed requireFeed(Long tenantId, Long feedId) {
        return subscriberFeedRepository.findByIdAndTenantId(feedId, tenantId)
                .orElseThrow(SubscriberFeedNotFoundException::new);
    }

    @Transactional
    public SubscriberFeed setFeedEnabled(Long tenantId, Long feedId, boolean enabled) {
        return persistEnabled(requireFeed(tenantId, feedId), enabled);
    }

    @Transactional
    public SubscriberFeed setDefaultFeedEnabled(Long tenantId, Long userId, boolean enabled) {
        return persistEnabled(ensureDefaultFeed(tenantId, userId), enabled);
    }

    @Transactional
    public SubscriberFeed setOwnedFeedEnabled(Long tenantId, Long userId, Long feedId, boolean enabled) {
        return persistEnabled(requireOwnedFeed(tenantId, userId, feedId), enabled);
    }

    @Transactional
    public SubscriberFeed createCustomFeed(Long tenantId, Long userId, String rawTitle, Collection<Long> formatIds) {
        ensureDefaultFeed(tenantId, userId);

        // Acquire lock on user's default feed to serialize concurrent creates
        subscriberFeedRepository.findWithLockByTenantIdAndUserIdAndDefaultFeedTrue(tenantId, userId)
                .orElseThrow(() -> new IllegalStateException("Default feed not found after ensureDefaultFeed"));

        if (subscriberFeedRepository.countByTenantIdAndUserIdAndDefaultFeedFalse(tenantId, userId)
                >= MAX_CUSTOM_FEEDS_PER_USER) {
            throw FeedBuilderException.conflict(
                    "FEED_LIMIT_REACHED",
                    "At most " + MAX_CUSTOM_FEEDS_PER_USER + " custom feeds are allowed"
            );
        }
        String title = normalizeTitle(rawTitle);
        if (subscriberFeedRepository.existsByTenantIdAndUserIdAndDefaultFeedFalseAndTitleIgnoreCase(
                tenantId, userId, title
        )) {
            throw FeedBuilderException.conflict("FEED_TITLE_DUPLICATE", "A custom feed with this title already exists");
        }

        Tenant tenant = tenantRepository.getReferenceById(tenantId);
        SubscriberFeed feed = new SubscriberFeed();
        feed.setTenant(tenant);
        feed.setUser(userRepository.getReferenceById(userId));
        feed.setTitle(title);
        feed.setDefaultFeed(false);
        feed.setEnabled(true);
        feed.setFeedToken(generateUniqueToken());
        feed.getFormats().addAll(resolveActiveFormats(tenantId, formatIds));

        try {
            SubscriberFeed saved = subscriberFeedRepository.save(feed);
            rssFeedRefreshScheduler.requestRefreshAfterCommit(tenantId);
            return saved;
        } catch (DataIntegrityViolationException ex) {
            if (ex.getCause() instanceof ConstraintViolationException cve) {
                String constraintName = cve.getConstraintName();
                if (constraintName != null && constraintName.contains("uq_subscriber_feeds_custom_title")) {
                    throw FeedBuilderException.conflict("FEED_TITLE_DUPLICATE", "A custom feed with this title already exists");
                }
            }
            throw ex;
        }
    }

    @Transactional
    public SubscriberFeed updateCustomFeed(
            Long tenantId,
            Long userId,
            Long feedId,
            String rawTitle,
            Collection<Long> formatIds
    ) {
        SubscriberFeed feed = requireOwnedCustomFeed(
                tenantId,
                userId,
                feedId,
                "DEFAULT_FEED_NOT_FILTERABLE",
                "The default private feed cannot be filtered"
        );
        if (rawTitle == null && formatIds == null) {
            throw FeedBuilderException.badRequest("FEED_TITLE_INVALID", "title or formatIds is required");
        }
        if (rawTitle != null) {
            String title = normalizeTitle(rawTitle);
            if (subscriberFeedRepository.existsByTenantIdAndUserIdAndDefaultFeedFalseAndIdNotAndTitleIgnoreCase(
                    tenantId, userId, feedId, title
            )) {
                throw FeedBuilderException.conflict(
                        "FEED_TITLE_DUPLICATE",
                        "A custom feed with this title already exists"
                );
            }
            feed.setTitle(title);
        }
        if (formatIds != null) {
            feed.getFormats().clear();
            feed.getFormats().addAll(resolveActiveFormats(tenantId, formatIds));
        }
        SubscriberFeed saved = subscriberFeedRepository.save(feed);
        rssFeedRefreshScheduler.requestRefreshAfterCommit(tenantId);
        return saved;
    }

    @Transactional
    public SubscriberFeed deleteCustomFeed(Long tenantId, Long userId, Long feedId) {
        SubscriberFeed feed = requireOwnedCustomFeed(
                tenantId,
                userId,
                feedId,
                "DEFAULT_FEED_NOT_DELETABLE",
                "The default private feed cannot be deleted"
        );
        withdrawSnapshot(feed);
        subscriberFeedRepository.delete(feed);
        rssFeedRefreshScheduler.requestRefreshAfterCommit(tenantId);
        return feed;
    }

    @Transactional(readOnly = true)
    public FeedPreview preview(Long tenantId, Long userId, Collection<Long> formatIds) {
        Set<Format> formats = resolveActiveFormats(tenantId, formatIds);
        Set<Long> formatIdSet = new LinkedHashSet<>();
        formats.forEach(format -> formatIdSet.add(format.getId()));
        return previewMatching(tenantId, userId, formatIdSet);
    }

    @Transactional(readOnly = true)
    public FeedPreview previewOwnedFeed(Long tenantId, Long userId, Long feedId) {
        SubscriberFeed feed = requireOwnedCustomFeed(
                tenantId,
                userId,
                feedId,
                "DEFAULT_FEED_NOT_FILTERABLE",
                "The default private feed cannot be previewed as a custom feed"
        );
        return previewMatching(tenantId, userId, SubscriberFeedFormatMatcher.selectedActiveFormatIds(feed));
    }

    public record FeedPreview(int episodeCount, List<String> sampleTitles) {
    }

    private FeedPreview previewMatching(Long tenantId, Long userId, Set<Long> activeFormatIds) {
        List<Episode> matches = subscriberEpisodeService.listEntitledEpisodes(tenantId, userId).stream()
                .filter(Episode::isEnclosureEnabled)
                .filter(episode -> SubscriberFeedFormatMatcher.episodeMatchesSelectedFormats(episode, activeFormatIds))
                .toList();
        List<String> samples = matches.stream()
                .limit(PREVIEW_SAMPLE_SIZE)
                .map(Episode::getTitle)
                .toList();
        return new FeedPreview(matches.size(), samples);
    }

    private SubscriberFeed requireOwnedFeed(Long tenantId, Long userId, Long feedId) {
        return subscriberFeedRepository.findByIdAndTenantIdAndUserId(feedId, tenantId, userId)
                .orElseThrow(SubscriberFeedNotFoundException::new);
    }

    private SubscriberFeed requireOwnedCustomFeed(
            Long tenantId,
            Long userId,
            Long feedId,
            String defaultFeedCode,
            String defaultFeedMessage
    ) {
        SubscriberFeed feed = requireOwnedFeed(tenantId, userId, feedId);
        if (feed.isDefaultFeed()) {
            throw FeedBuilderException.conflict(defaultFeedCode, defaultFeedMessage);
        }
        return feed;
    }

    private SubscriberFeed persistEnabled(SubscriberFeed feed, boolean enabled) {
        feed.setEnabled(enabled);
        SubscriberFeed saved = subscriberFeedRepository.save(feed);
        rssFeedRefreshScheduler.requestRefreshAfterCommit(saved.getTenant().getId());
        return saved;
    }

    private SubscriberFeed rotateToken(SubscriberFeed feed) {
        feed.setFeedToken(generateUniqueToken());
        SubscriberFeed saved = subscriberFeedRepository.save(feed);
        rssFeedRefreshScheduler.requestRefreshAfterCommit(saved.getTenant().getId());
        return saved;
    }

    private Set<Format> resolveActiveFormats(Long tenantId, Collection<Long> formatIds) {
        if (formatIds == null || formatIds.isEmpty()) {
            throw FeedBuilderException.badRequest("FEED_FORMATS_REQUIRED", "Select at least one format");
        }
        LinkedHashSet<Long> distinctIds = new LinkedHashSet<>();
        for (Long formatId : formatIds) {
            if (formatId != null) {
                distinctIds.add(formatId);
            }
        }
        if (distinctIds.isEmpty()) {
            throw FeedBuilderException.badRequest("FEED_FORMATS_REQUIRED", "Select at least one format");
        }
        List<Format> resolved = new ArrayList<>();
        for (Long formatId : distinctIds) {
            Format format = formatRepository.findByIdAndTenantId(formatId, tenantId)
                    .orElseThrow(() -> FeedBuilderException.badRequest(
                            "FEED_FORMAT_INVALID",
                            "Unknown format: " + formatId
                    ));
            if (!format.isActive()) {
                throw FeedBuilderException.badRequest("FEED_FORMAT_INVALID", "Format is inactive: " + formatId);
            }
            resolved.add(format);
        }
        resolved.sort(Comparator.comparingInt(Format::getSortOrder).thenComparing(Format::getId));
        return new LinkedHashSet<>(resolved);
    }

    private static String normalizeTitle(String rawTitle) {
        if (rawTitle == null || rawTitle.isBlank()) {
            throw FeedBuilderException.badRequest("FEED_TITLE_INVALID", "Feed title is required");
        }
        String title = rawTitle.trim();
        if (title.length() > MAX_TITLE_LENGTH) {
            throw FeedBuilderException.badRequest(
                    "FEED_TITLE_INVALID",
                    "Feed title must be at most " + MAX_TITLE_LENGTH + " characters"
            );
        }
        return title;
    }

    private void withdrawSnapshot(SubscriberFeed feed) {
        try {
            rssFeedSnapshotService.withdrawPrivateFeed(feed.getTenant(), feed.getId());
        } catch (StorageNotConfiguredException | IllegalStateException ignored) {
            // Local/dev without object storage still deletes the row.
        }
    }

    private SubscriberFeed createDefaultFeed(Long tenantId, Long userId) {
        Tenant tenant = tenantRepository.getReferenceById(tenantId);

        SubscriberFeed feed = new SubscriberFeed();
        feed.setTenant(tenant);
        feed.setUser(userRepository.getReferenceById(userId));
        feed.setTitle(tenant.getName() + " Private Feed");
        feed.setDefaultFeed(true);
        feed.setFeedToken(generateUniqueToken());
        SubscriberFeed saved = subscriberFeedRepository.save(feed);
        rssFeedRefreshScheduler.requestRefreshAfterCommit(tenantId);
        return saved;
    }

    private String generateUniqueToken() {
        String token;
        do {
            token = feedTokenGenerator.generate();
        } while (subscriberFeedRepository.existsByFeedToken(token));
        return token;
    }
}
