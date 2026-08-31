package de.pnnit.directwerk.modules.newsletter.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.core.FeatureModuleKeys;
import de.pnnit.directwerk.modules.core.entity.MembershipStatus;
import de.pnnit.directwerk.modules.core.repository.TenantMembershipRepository;
import de.pnnit.directwerk.modules.core.repository.TenantModuleActivationRepository;
import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ArticleFeedProvisioningServiceTest {

    @Mock
    private ArticleFeedService articleFeedService;

    @Mock
    private TenantMembershipRepository tenantMembershipRepository;

    @Mock
    private TenantModuleActivationRepository tenantModuleActivationRepository;

    @Mock
    private ModuleGateService moduleGateService;

    @InjectMocks
    private ArticleFeedProvisioningService articleFeedProvisioningService;

    @Test
    void provisionDefaultFeedSkipsWhenPrivateFeedModulesAreOff() {
        when(moduleGateService.isModuleActive(10L, FeatureModuleKeys.ARTICLE_RSS)).thenReturn(false);

        articleFeedProvisioningService.provisionDefaultFeed(10L, 20L);

        verify(articleFeedService, never()).ensureDefaultFeed(10L, 20L);
    }

    @Test
    void provisionDefaultFeedCreatesFeedWhenModulesAreOn() {
        when(moduleGateService.isModuleActive(10L, FeatureModuleKeys.ARTICLE_RSS)).thenReturn(true);
        when(moduleGateService.isModuleActive(10L, FeatureModuleKeys.SUBSCRIPTION)).thenReturn(true);

        articleFeedProvisioningService.provisionDefaultFeed(10L, 20L);

        verify(articleFeedService).ensureDefaultFeed(10L, 20L);
    }

    @Test
    void provisionMissingDefaultFeedsCreatesOnlyForUsersWithoutDefaultFeed() {
        when(tenantModuleActivationRepository.findTenantIdsWithActiveModule(FeatureModuleKeys.ARTICLE_RSS))
                .thenReturn(List.of(10L));
        when(tenantModuleActivationRepository.findTenantIdsWithActiveModule(FeatureModuleKeys.SUBSCRIPTION))
                .thenReturn(List.of(10L));
        when(moduleGateService.isModuleActive(10L, FeatureModuleKeys.ARTICLE_RSS)).thenReturn(true);
        when(moduleGateService.isModuleActive(10L, FeatureModuleKeys.SUBSCRIPTION)).thenReturn(true);
        when(tenantMembershipRepository.findActiveUserIdsByTenantId(10L, MembershipStatus.ACTIVE))
                .thenReturn(List.of(20L, 30L));
        when(articleFeedService.hasDefaultFeed(10L, 20L)).thenReturn(true);
        when(articleFeedService.hasDefaultFeed(10L, 30L)).thenReturn(false);

        int created = articleFeedProvisioningService.provisionMissingDefaultFeeds();

        assertThat(created).isEqualTo(1);
        verify(articleFeedService).ensureDefaultFeed(10L, 30L);
        verify(articleFeedService, never()).ensureDefaultFeed(10L, 20L);
    }
}
