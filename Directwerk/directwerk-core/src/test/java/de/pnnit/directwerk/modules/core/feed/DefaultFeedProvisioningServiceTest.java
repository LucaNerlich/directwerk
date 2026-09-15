package de.pnnit.directwerk.modules.core.feed;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.core.FeatureModuleKeys;
import de.pnnit.directwerk.modules.core.entity.MembershipStatus;
import de.pnnit.directwerk.modules.core.repository.TenantMembershipRepository;
import de.pnnit.directwerk.modules.core.repository.TenantModuleActivationRepository;
import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class DefaultFeedProvisioningServiceTest {

    @Mock
    private TenantMembershipRepository tenantMembershipRepository;

    @Mock
    private TenantModuleActivationRepository tenantModuleActivationRepository;

    @Mock
    private ModuleGateService moduleGateService;

    private DefaultFeedProvisioningService service;
    private RecordingStore store;

    @BeforeEach
    void setUp() {
        service = new DefaultFeedProvisioningService(
                tenantMembershipRepository,
                tenantModuleActivationRepository,
                moduleGateService
        );
        store = new RecordingStore();
    }

    @Test
    void provisionDefaultFeedSkipsWhenPrivateFeedModulesAreOff() {
        when(moduleGateService.isModuleActive(10L, FeatureModuleKeys.PODCAST_RSS)).thenReturn(false);

        service.provisionDefaultFeed(FeatureModuleKeys.PODCAST_RSS, 10L, 20L, store);

        assertThat(store.ensured).isEmpty();
    }

    @Test
    void provisionDefaultFeedCreatesFeedWhenModulesAreOn() {
        when(moduleGateService.isModuleActive(10L, FeatureModuleKeys.PODCAST_RSS)).thenReturn(true);
        when(moduleGateService.isModuleActive(10L, FeatureModuleKeys.SUBSCRIPTION)).thenReturn(true);

        service.provisionDefaultFeed(FeatureModuleKeys.PODCAST_RSS, 10L, 20L, store);

        assertThat(store.ensured).containsExactly(20L);
    }

    @Test
    void provisionMissingDefaultFeedsCreatesOnlyForUsersWithoutDefaultFeed() {
        when(tenantModuleActivationRepository.findTenantIdsWithActiveModule(FeatureModuleKeys.PODCAST_RSS))
                .thenReturn(List.of(10L));
        when(tenantModuleActivationRepository.findTenantIdsWithActiveModule(FeatureModuleKeys.SUBSCRIPTION))
                .thenReturn(List.of(10L));
        when(moduleGateService.isModuleActive(10L, FeatureModuleKeys.PODCAST_RSS)).thenReturn(true);
        when(moduleGateService.isModuleActive(10L, FeatureModuleKeys.SUBSCRIPTION)).thenReturn(true);
        when(tenantMembershipRepository.findActiveUserIdsByTenantId(10L, MembershipStatus.ACTIVE))
                .thenReturn(List.of(20L, 30L));
        store.existing.add(20L);

        int created = service.provisionMissingDefaultFeeds(FeatureModuleKeys.PODCAST_RSS, store);

        assertThat(created).isEqualTo(1);
        assertThat(store.ensured).containsExactly(30L);
    }

    @Test
    void provisionMissingDefaultFeedsForTenantIsGated() {
        when(moduleGateService.isModuleActive(10L, FeatureModuleKeys.ARTICLE_RSS)).thenReturn(true);
        when(moduleGateService.isModuleActive(10L, FeatureModuleKeys.SUBSCRIPTION)).thenReturn(false);

        int created = service.provisionMissingDefaultFeeds(FeatureModuleKeys.ARTICLE_RSS, 10L, store);

        assertThat(created).isZero();
        verify(tenantMembershipRepository, never()).findActiveUserIdsByTenantId(10L, MembershipStatus.ACTIVE);
    }

    private static final class RecordingStore implements DefaultFeedStore {

        private final Set<Long> existing = new HashSet<>();
        private final List<Long> ensured = new java.util.ArrayList<>();

        @Override
        public boolean hasDefaultFeed(Long tenantId, Long userId) {
            return existing.contains(userId);
        }

        @Override
        public void ensureDefaultFeed(Long tenantId, Long userId) {
            ensured.add(userId);
        }
    }
}
