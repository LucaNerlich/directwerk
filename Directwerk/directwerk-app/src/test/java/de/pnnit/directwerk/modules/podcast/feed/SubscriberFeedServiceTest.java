package de.pnnit.directwerk.modules.podcast.feed;

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
import de.pnnit.directwerk.modules.podcast.job.RssFeedRefreshJobProducer;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class SubscriberFeedServiceTest {

    @Mock
    private SubscriberFeedRepository subscriberFeedRepository;

    @Mock
    private TenantRepository tenantRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private RssFeedRefreshJobProducer rssFeedRefreshJobProducer;

    @InjectMocks
    private SubscriberFeedService subscriberFeedService;

    @Test
    void requireFeedReturnsTenantMatchedFeed() {
        SubscriberFeed feed = feed(10L, 1L);
        when(subscriberFeedRepository.findByIdAndTenantId(1L, 10L)).thenReturn(Optional.of(feed));

        assertThat(subscriberFeedService.requireFeed(10L, 1L)).isSameAs(feed);
    }

    @Test
    void requireFeedRejectsTenantMismatch() {
        when(subscriberFeedRepository.findByIdAndTenantId(1L, 99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> subscriberFeedService.requireFeed(99L, 1L))
                .isInstanceOf(SubscriberFeedNotFoundException.class);
    }

    @Test
    void setFeedEnabledPersistsToggleForTenantScopedFeed() {
        SubscriberFeed feed = feed(10L, 1L);
        when(subscriberFeedRepository.findByIdAndTenantId(1L, 10L)).thenReturn(Optional.of(feed));
        when(subscriberFeedRepository.save(feed)).thenReturn(feed);

        SubscriberFeed updated = subscriberFeedService.setFeedEnabled(10L, 1L, false);

        assertThat(updated.isEnabled()).isFalse();
        ArgumentCaptor<SubscriberFeed> captor = ArgumentCaptor.forClass(SubscriberFeed.class);
        verify(subscriberFeedRepository).save(captor.capture());
        assertThat(captor.getValue().isEnabled()).isFalse();
        assertThat(captor.getValue().getTenant().getId()).isEqualTo(10L);
        verify(rssFeedRefreshJobProducer).requestRefreshAfterCommit(10L);
    }

    @Test
    void setFeedEnabledRejectsTenantMismatch() {
        when(subscriberFeedRepository.findByIdAndTenantId(1L, 99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> subscriberFeedService.setFeedEnabled(99L, 1L, false))
                .isInstanceOf(SubscriberFeedNotFoundException.class);
        verify(subscriberFeedRepository, never()).save(any());
    }

    @Test
    void setDefaultFeedEnabledUsesEnsureDefaultFeedAndPersists() {
        SubscriberFeed feed = feed(10L, 1L);
        when(subscriberFeedRepository.findByTenantIdAndUserIdAndDefaultFeedTrue(10L, 99L))
                .thenReturn(Optional.of(feed));
        when(subscriberFeedRepository.save(feed)).thenReturn(feed);

        SubscriberFeed updated = subscriberFeedService.setDefaultFeedEnabled(10L, 99L, false);

        assertThat(updated.isEnabled()).isFalse();
        verify(subscriberFeedRepository).findByTenantIdAndUserIdAndDefaultFeedTrue(10L, 99L);
        verify(subscriberFeedRepository).save(feed);
        verify(tenantRepository, never()).getReferenceById(any());
    }

    private static SubscriberFeed feed(Long tenantId, Long feedId) {
        Tenant tenant = new Tenant();
        tenant.setId(tenantId);
        tenant.setSlug("alpha");
        tenant.setName("Alpha");

        User user = new User();
        user.setId(99L);

        SubscriberFeed feed = new SubscriberFeed();
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
