package de.pnnit.directwerk.modules.podcast.service;

import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.feed.FeedProvisioningSupport;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import de.pnnit.directwerk.modules.core.service.ModuleNotEnabledException;
import de.pnnit.directwerk.modules.core.service.FeedTokenProtector;
import de.pnnit.directwerk.modules.podcast.FeedBuilderModule;
import de.pnnit.directwerk.modules.core.repository.UserRepository;
import de.pnnit.directwerk.modules.digital.exception.StorageNotConfiguredException;
import de.pnnit.directwerk.modules.podcast.entity.Episode;
import de.pnnit.directwerk.modules.podcast.entity.Format;
import de.pnnit.directwerk.modules.podcast.job.RssFeedRefreshJobProducer;
import de.pnnit.directwerk.modules.podcast.repository.FormatRepository;
import de.pnnit.directwerk.modules.core.util.FeedTokenGenerator;
import de.pnnit.directwerk.modules.core.util.TokenHashUtil;
import de.pnnit.directwerk.modules.podcast.feed.FeedBuilderException;
import de.pnnit.directwerk.modules.podcast.feed.SubscriberFeed;
import de.pnnit.directwerk.modules.podcast.access.SubscriberFeedAccess;
import de.pnnit.directwerk.modules.podcast.feed.SubscriberFeedFormatMatcher;
import de.pnnit.directwerk.modules.podcast.feed.SubscriberFeedNotFoundException;
import de.pnnit.directwerk.modules.podcast.feed.SubscriberFeedRepository;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.function.Supplier;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

@Service
@RequiredArgsConstructor
public class SubscriberFeedService {

    private final SubscriberFeedRepository subscriberFeedRepository;
    private final TenantRepository tenantRepository;
    private final UserRepository userRepository;
    private final FormatRepository formatRepository;
    private final SubscriberFeedAccess subscriberFeedAccess;
    private final FeedTokenGenerator feedTokenGenerator;
    private final FeedTokenProtector feedTokenProtector;
    private final ModuleGateService moduleGateService;
    private final RssFeedSnapshotService rssFeedSnapshotService;
    private final RssFeedRefreshJobProducer rssFeedRefreshScheduler;
    private final PlatformTransactionManager transactionManager;

    /**
     * Resolves a subscriber feed by its token.
     *
     * <p>The presented raw token is hashed first and matched against the
     * {@code feed_token_hash} blind index; the encrypted {@code feed_token}
     * column is never compared directly.
     *
     * @param feedToken the raw token identifying the feed
     * @return the matching subscriber feed
     * @throws SubscriberFeedNotFoundException if no feed matches the token
     */
    @Transactional(readOnly = true)
    public SubscriberFeed requireFeedByToken(String feedToken) {
        return subscriberFeedRepository.findByFeedTokenHash(TokenHashUtil.sha256Hex(feedToken))
                .orElseThrow(SubscriberFeedNotFoundException::new);
    }

    /**
     * @param feed a feed resolved via this service
     * @return the cleartext bearer token for URL building (views, snapshots)
     */
    @Transactional(readOnly = true)
    public String revealToken(SubscriberFeed feed) {
        return feedTokenProtector.reveal(feed.getFeedToken());
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

    @Transactional(readOnly = true)
    public boolean hasDefaultFeed(Long tenantId, Long userId) {
        return subscriberFeedRepository.findByTenantIdAndUserIdAndDefaultFeedTrue(tenantId, userId).isPresent();
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

        FeedProvisioningSupport.requireBelowCustomFeedLimit(
                subscriberFeedRepository.countByTenantIdAndUserIdAndDefaultFeedFalse(tenantId, userId),
                FeedBuilderException::conflict);
        String title = FeedProvisioningSupport.normalizeTitle(rawTitle, FeedBuilderException::badRequest);
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
        FeedProvisioningSupport.IssuedToken issued = FeedProvisioningSupport.issueUniqueToken(
                feedTokenGenerator::generate,
                subscriberFeedRepository::existsByFeedTokenHash,
                feedTokenProtector::protect);
        feed.setFeedToken(issued.protectedToken());
        feed.setFeedTokenHash(issued.tokenHash());
        feed.getFormats().addAll(resolveActiveFormats(tenantId, formatIds));

        try {
            SubscriberFeed saved = subscriberFeedRepository.save(feed);
            rssFeedRefreshScheduler.requestRefreshAfterCommit(tenantId);
            return saved;
        } catch (DataIntegrityViolationException ex) {
            if (FeedProvisioningSupport.isUniqueConstraintViolation(ex, "uq_subscriber_feeds_custom_title")) {
                throw FeedBuilderException.conflict("FEED_TITLE_DUPLICATE", "A custom feed with this title already exists");
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
            String title = FeedProvisioningSupport.normalizeTitle(rawTitle, FeedBuilderException::badRequest);
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
        List<Episode> matches = subscriberFeedAccess.listEntitledEpisodesForFormats(tenantId, userId, activeFormatIds).stream()
                .filter(Episode::isEnclosureEnabled)
                .toList();
        List<String> samples = matches.stream()
                .limit(FeedProvisioningSupport.PREVIEW_SAMPLE_SIZE)
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
        FeedProvisioningSupport.IssuedToken issued = FeedProvisioningSupport.issueUniqueToken(
                feedTokenGenerator::generate,
                subscriberFeedRepository::existsByFeedTokenHash,
                feedTokenProtector::protect);
        feed.setFeedToken(issued.protectedToken());
        feed.setFeedTokenHash(issued.tokenHash());
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

    private void withdrawSnapshot(SubscriberFeed feed) {
        try {
            rssFeedSnapshotService.withdrawPrivateFeed(feed.getTenant(), feed.getId());
        } catch (StorageNotConfiguredException | IllegalStateException ignored) {
            // Local/dev without object storage still deletes the row.
        }
    }

    private SubscriberFeed createDefaultFeed(Long tenantId, Long userId) {
        try {
            return inNewTransaction(() -> {
                Tenant tenant = tenantRepository.getReferenceById(tenantId);
                SubscriberFeed feed = new SubscriberFeed();
                feed.setTenant(tenant);
                feed.setUser(userRepository.getReferenceById(userId));
                feed.setTitle(tenant.getName() + " Private Feed");
                feed.setDefaultFeed(true);
                FeedProvisioningSupport.IssuedToken issued = FeedProvisioningSupport.issueUniqueToken(
                        feedTokenGenerator::generate,
                        subscriberFeedRepository::existsByFeedTokenHash,
                        feedTokenProtector::protect);
                feed.setFeedToken(issued.protectedToken());
                feed.setFeedTokenHash(issued.tokenHash());
                SubscriberFeed saved = subscriberFeedRepository.saveAndFlush(feed);
                rssFeedRefreshScheduler.requestRefreshAfterCommit(tenantId);
                return saved;
            });
        } catch (DataIntegrityViolationException ex) {
            if (FeedProvisioningSupport.isUniqueConstraintViolation(ex, "uq_subscriber_feeds_default")) {
                // Concurrent first-time ensureDefaultFeed calls can both attempt the insert;
                // the loser reads back the winner in a clean transaction.
                return inNewTransaction(() -> subscriberFeedRepository
                        .findByTenantIdAndUserIdAndDefaultFeedTrue(tenantId, userId)
                        .orElseThrow(() -> ex));
            }
            throw ex;
        }
    }

    private <T> T inNewTransaction(Supplier<T> operation) {
        TransactionTemplate transaction = new TransactionTemplate(transactionManager);
        transaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        return transaction.execute(status -> operation.get());
    }
}
