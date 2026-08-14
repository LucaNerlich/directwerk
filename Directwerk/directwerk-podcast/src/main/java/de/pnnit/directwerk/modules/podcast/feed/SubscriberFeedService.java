package de.pnnit.directwerk.modules.podcast.feed;

import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.core.repository.UserRepository;
import de.pnnit.directwerk.modules.podcast.job.RssFeedRefreshJobProducer;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class SubscriberFeedService {

    private static final int TOKEN_BYTES = 24;

    private final SubscriberFeedRepository subscriberFeedRepository;
    private final TenantRepository tenantRepository;
    private final UserRepository userRepository;
    private final RssFeedRefreshJobProducer rssFeedRefreshJobProducer;
    private final SecureRandom secureRandom = new SecureRandom();

    @Transactional(readOnly = true)
    public SubscriberFeed requireFeedByToken(String feedToken) {
        return subscriberFeedRepository.findByFeedToken(feedToken)
                .orElseThrow(() -> new SubscriberFeedNotFoundException());
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
        feed.setFeedToken(generateUniqueToken());
        SubscriberFeed saved = subscriberFeedRepository.save(feed);
        rssFeedRefreshJobProducer.requestRefreshAfterCommit(tenantId);
        return saved;
    }

    @Transactional(readOnly = true)
    public SubscriberFeed requireFeed(Long tenantId, Long feedId) {
        return subscriberFeedRepository.findByIdAndTenantId(feedId, tenantId)
                .orElseThrow(SubscriberFeedNotFoundException::new);
    }

    @Transactional
    public SubscriberFeed setFeedEnabled(Long tenantId, Long feedId, boolean enabled) {
        SubscriberFeed feed = requireFeed(tenantId, feedId);
        feed.setEnabled(enabled);
        SubscriberFeed saved = subscriberFeedRepository.save(feed);
        rssFeedRefreshJobProducer.requestRefreshAfterCommit(tenantId);
        return saved;
    }

    @Transactional
    public SubscriberFeed setDefaultFeedEnabled(Long tenantId, Long userId, boolean enabled) {
        SubscriberFeed feed = ensureDefaultFeed(tenantId, userId);
        feed.setEnabled(enabled);
        SubscriberFeed saved = subscriberFeedRepository.save(feed);
        rssFeedRefreshJobProducer.requestRefreshAfterCommit(tenantId);
        return saved;
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
        rssFeedRefreshJobProducer.requestRefreshAfterCommit(tenantId);
        return saved;
    }

    private String generateUniqueToken() {
        String token;
        do {
            byte[] bytes = new byte[TOKEN_BYTES];
            secureRandom.nextBytes(bytes);
            token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        } while (subscriberFeedRepository.existsByFeedToken(token));
        return token;
    }
}
