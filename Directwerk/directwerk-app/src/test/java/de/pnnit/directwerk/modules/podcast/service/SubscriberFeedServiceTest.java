package de.pnnit.directwerk.modules.podcast.service;

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
import de.pnnit.directwerk.modules.podcast.entity.Format;
import de.pnnit.directwerk.modules.podcast.feed.FeedBuilderException;
import de.pnnit.directwerk.modules.podcast.feed.SubscriberFeed;
import de.pnnit.directwerk.modules.podcast.feed.SubscriberFeedNotFoundException;
import de.pnnit.directwerk.modules.podcast.feed.SubscriberFeedRepository;
import de.pnnit.directwerk.modules.podcast.repository.FormatRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
@org.mockito.junit.jupiter.MockitoSettings(strictness = org.mockito.quality.Strictness.LENIENT)
class SubscriberFeedServiceTest {

    @BeforeEach
    void stubTokenGeneration() {
        org.mockito.Mockito.lenient().doReturn("tok-default")
                .when(feedTokenGenerator).generate();
    }

    @Mock
    private SubscriberFeedRepository subscriberFeedRepository;

    @Mock
    private TenantRepository tenantRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private FormatRepository formatRepository;

    @Mock
    private de.pnnit.directwerk.modules.podcast.access.SubscriberFeedAccess subscriberFeedAccess;

    @Mock
    private RssFeedSnapshotService rssFeedSnapshotService;

    @Mock
    private RssFeedRefreshScheduler rssFeedRefreshScheduler;

    @Mock
    private de.pnnit.directwerk.modules.core.util.FeedTokenGenerator feedTokenGenerator;

    @Mock
    private de.pnnit.directwerk.modules.core.service.ModuleGateService moduleGateService;

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
        verify(rssFeedRefreshScheduler).requestRefreshAfterCommit(10L);
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

    @Test
    void createCustomFeedPersistsFormatsAndEnqueuesRefresh() {
        SubscriberFeed defaultFeed = feed(10L, 1L);
        when(subscriberFeedRepository.findByTenantIdAndUserIdAndDefaultFeedTrue(10L, 99L))
                .thenReturn(Optional.of(defaultFeed));
        when(subscriberFeedRepository.findWithLockByTenantIdAndUserIdAndDefaultFeedTrue(10L, 99L))
                .thenReturn(Optional.of(defaultFeed));
        when(subscriberFeedRepository.countByTenantIdAndUserIdAndDefaultFeedFalse(10L, 99L)).thenReturn(0L);
        when(subscriberFeedRepository.existsByTenantIdAndUserIdAndDefaultFeedFalseAndTitleIgnoreCase(
                10L, 99L, "Nur Interviews"
        )).thenReturn(false);
        when(tenantRepository.getReferenceById(10L)).thenReturn(defaultFeed.getTenant());
        when(userRepository.getReferenceById(99L)).thenReturn(defaultFeed.getUser());
        when(formatRepository.findByIdAndTenantId(3L, 10L)).thenReturn(Optional.of(format(3L, true)));
        when(subscriberFeedRepository.existsByFeedToken(org.mockito.ArgumentMatchers.anyString())).thenReturn(false);
        when(subscriberFeedRepository.save(any(SubscriberFeed.class))).thenAnswer(invocation -> {
            SubscriberFeed saved = invocation.getArgument(0);
            saved.setId(12L);
            return saved;
        });

        SubscriberFeed created = subscriberFeedService.createCustomFeed(10L, 99L, "  Nur Interviews  ", List.of(3L));

        assertThat(created.isDefaultFeed()).isFalse();
        assertThat(created.getTitle()).isEqualTo("Nur Interviews");
        assertThat(created.getFormats()).extracting(Format::getId).containsExactly(3L);
        verify(rssFeedRefreshScheduler).requestRefreshAfterCommit(10L);
    }

    @Test
    void createCustomFeedRejectsWhenLimitReached() {
        SubscriberFeed defaultFeed = feed(10L, 1L);
        when(subscriberFeedRepository.findByTenantIdAndUserIdAndDefaultFeedTrue(10L, 99L))
                .thenReturn(Optional.of(defaultFeed));
        when(subscriberFeedRepository.findWithLockByTenantIdAndUserIdAndDefaultFeedTrue(10L, 99L))
                .thenReturn(Optional.of(defaultFeed));
        when(subscriberFeedRepository.countByTenantIdAndUserIdAndDefaultFeedFalse(10L, 99L)).thenReturn(5L);

        assertThatThrownBy(() -> subscriberFeedService.createCustomFeed(10L, 99L, "Extra", List.of(3L)))
                .isInstanceOf(FeedBuilderException.class)
                .extracting(ex -> ((FeedBuilderException) ex).getCode())
                .isEqualTo("FEED_LIMIT_REACHED");
        verify(subscriberFeedRepository, never()).save(any());
    }

    @Test
    void deleteCustomFeedRejectsDefaultFeed() {
        SubscriberFeed defaultFeed = feed(10L, 1L);
        when(subscriberFeedRepository.findByIdAndTenantIdAndUserId(1L, 10L, 99L))
                .thenReturn(Optional.of(defaultFeed));

        assertThatThrownBy(() -> subscriberFeedService.deleteCustomFeed(10L, 99L, 1L))
                .isInstanceOf(FeedBuilderException.class)
                .extracting(ex -> ((FeedBuilderException) ex).getCode())
                .isEqualTo("DEFAULT_FEED_NOT_DELETABLE");
        verify(subscriberFeedRepository, never()).delete(any());
    }

    @Test
    void deleteCustomFeedWithdrawsThenDeletes() {
        SubscriberFeed custom = feed(10L, 12L);
        custom.setDefaultFeed(false);
        when(subscriberFeedRepository.findByIdAndTenantIdAndUserId(12L, 10L, 99L))
                .thenReturn(Optional.of(custom));

        subscriberFeedService.deleteCustomFeed(10L, 99L, 12L);

        verify(rssFeedSnapshotService).withdrawPrivateFeed(custom.getTenant(), 12L);
        verify(subscriberFeedRepository).delete(custom);
        verify(rssFeedRefreshScheduler).requestRefreshAfterCommit(10L);
    }

    private static Format format(Long id, boolean active) {
        Format format = new Format();
        format.setId(id);
        format.setSlug("interview");
        format.setName("Interview");
        format.setActive(active);
        format.setSortOrder(10);
        return format;
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
