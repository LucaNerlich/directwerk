package de.pnnit.directwerk.modules.subscription.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.core.entity.MembershipStatus;
import de.pnnit.directwerk.modules.core.entity.Role;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.entity.TenantMembership;
import de.pnnit.directwerk.modules.core.entity.User;
import de.pnnit.directwerk.modules.core.repository.TenantMembershipRepository;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import de.pnnit.directwerk.modules.subscription.SubscriptionModule;
import de.pnnit.directwerk.modules.subscription.entity.Subscription;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionProduct;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionSource;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionStatus;
import de.pnnit.directwerk.modules.subscription.repository.SubscriberDirectoryRepository;
import de.pnnit.directwerk.modules.subscription.repository.SubscriptionRepository;
import java.time.Instant;
import java.util.EnumSet;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class SubscriberDirectoryQueryServiceTest {

    private static final Long TENANT_ID = 5L;

    @Mock
    private TenantRepository tenantRepository;

    @Mock
    private TenantMembershipRepository tenantMembershipRepository;

    @Mock
    private SubscriberDirectoryRepository subscriberDirectoryRepository;

    @Mock
    private SubscriptionRepository subscriptionRepository;

    @Mock
    private ModuleGateService moduleGateService;

    @InjectMocks
    private SubscriberDirectoryQueryService service;

    @Test
    void listSubscribersSkipsSubscriptionLookupWhenModuleInactive() {
        when(tenantRepository.requireById(TENANT_ID)).thenReturn(new Tenant());
        when(moduleGateService.isModuleActive(TENANT_ID, SubscriptionModule.MODULE_KEY)).thenReturn(false);
        when(subscriberDirectoryRepository.countSubscriberUserIds(
                        eq(TENANT_ID), eq(false), eq(true), anyString()))
                .thenReturn(1L);
        when(subscriberDirectoryRepository.findSubscriberUserIds(
                        eq(TENANT_ID), eq(false), eq(true), anyString(), anyInt(), anyInt()))
                .thenReturn(List.of(1L));
        when(tenantMembershipRepository.findByTenantIdAndUserIdIn(TENANT_ID, List.of(1L)))
                .thenReturn(List.of(membership(1L, "sub@example.com", "Sub")));

        assertThat(service.listSubscribers(TENANT_ID, 0, 50, null).content()).hasSize(1);
        verify(subscriptionRepository, never()).findDetailedByTenantIdAndUserIdIn(eq(TENANT_ID), eq(List.of(1L)));
    }

    @Test
    void listSubscribersIncludesSubscriptionRecordsWhenModuleActive() {
        when(tenantRepository.requireById(TENANT_ID)).thenReturn(new Tenant());
        when(moduleGateService.isModuleActive(TENANT_ID, SubscriptionModule.MODULE_KEY)).thenReturn(true);
        when(subscriberDirectoryRepository.countSubscriberUserIds(
                        eq(TENANT_ID), eq(true), eq(true), anyString()))
                .thenReturn(1L);
        when(subscriberDirectoryRepository.findSubscriberUserIds(
                        eq(TENANT_ID), eq(true), eq(true), anyString(), anyInt(), anyInt()))
                .thenReturn(List.of(9L));
        when(tenantMembershipRepository.findByTenantIdAndUserIdIn(TENANT_ID, List.of(9L)))
                .thenReturn(List.of());
        when(subscriptionRepository.findDetailedByTenantIdAndUserIdIn(TENANT_ID, List.of(9L)))
                .thenReturn(List.of(sampleSubscription()));

        assertThat(service.listSubscribers(TENANT_ID, 0, 50, null).content())
                .singleElement()
                .satisfies(entry -> {
                    assertThat(entry.email()).isEqualTo("paid@example.com");
                    assertThat(entry.subscriptions()).hasSize(1);
                });
    }

    @Test
    void listSubscribersAppliesSearchAndPagingMetadata() {
        when(tenantRepository.requireById(TENANT_ID)).thenReturn(new Tenant());
        when(moduleGateService.isModuleActive(TENANT_ID, SubscriptionModule.MODULE_KEY)).thenReturn(true);
        when(subscriberDirectoryRepository.countSubscriberUserIds(
                        eq(TENANT_ID), eq(true), eq(false), eq("%alice%")))
                .thenReturn(3L);
        when(subscriberDirectoryRepository.findSubscriberUserIds(
                        eq(TENANT_ID), eq(true), eq(false), eq("%alice%"), eq(50), eq(50)))
                .thenReturn(List.of(2L));
        when(tenantMembershipRepository.findByTenantIdAndUserIdIn(TENANT_ID, List.of(2L)))
                .thenReturn(List.of(membership(2L, "alice@example.com", "Alice")));
        when(subscriptionRepository.findDetailedByTenantIdAndUserIdIn(TENANT_ID, List.of(2L)))
                .thenReturn(List.of());

        var page = service.listSubscribers(TENANT_ID, 1, 50, " alice ");
        assertThat(page.totalElements()).isEqualTo(3);
        assertThat(page.page()).isEqualTo(1);
        assertThat(page.size()).isEqualTo(50);
        assertThat(page.content()).extracting(SubscriberDirectoryQueryService.SubscriberDirectoryEntry::email)
                .containsExactly("alice@example.com");
    }

    @Test
    void countSubscribersUsesIdLevelUnion() {
        when(tenantRepository.requireById(TENANT_ID)).thenReturn(new Tenant());
        when(moduleGateService.isModuleActive(TENANT_ID, SubscriptionModule.MODULE_KEY)).thenReturn(true);
        when(subscriberDirectoryRepository.countSubscriberUserIds(
                        eq(TENANT_ID), eq(true), eq(true), anyString()))
                .thenReturn(12L);

        assertThat(service.countSubscribers(TENANT_ID)).isEqualTo(12L);
        verify(subscriberDirectoryRepository).countSubscriberUserIds(
                eq(TENANT_ID), eq(true), eq(true), anyString());
        verify(subscriberDirectoryRepository, never()).findSubscriberUserIds(
                eq(TENANT_ID), anyBoolean(), anyBoolean(), anyString(), anyInt(), anyInt());
    }

    private static TenantMembership membership(Long userId, String email, String name) {
        Tenant tenant = new Tenant();
        tenant.setId(TENANT_ID);

        User user = new User();
        user.setId(userId);
        user.setEmail(email);
        user.setName(name);

        TenantMembership membership = new TenantMembership();
        membership.setTenant(tenant);
        membership.setUser(user);
        membership.setRoles(EnumSet.of(Role.SUBSCRIBER));
        membership.setStatus(MembershipStatus.ACTIVE);
        return membership;
    }

    private static Subscription sampleSubscription() {
        Tenant tenant = new Tenant();
        tenant.setId(TENANT_ID);

        User user = new User();
        user.setId(9L);
        user.setEmail("paid@example.com");
        user.setName("Paid");

        SubscriptionProduct product = new SubscriptionProduct();
        product.setId(3L);
        product.setSlug("supporter");
        product.setTitle("Supporter");

        Subscription subscription = new Subscription();
        subscription.setId(11L);
        subscription.setTenant(tenant);
        subscription.setUser(user);
        subscription.setProduct(product);
        subscription.setStatus(SubscriptionStatus.ACTIVE);
        subscription.setSource(SubscriptionSource.MANUAL);
        subscription.setStartedAt(Instant.parse("2026-01-01T00:00:00Z"));
        return subscription;
    }
}
