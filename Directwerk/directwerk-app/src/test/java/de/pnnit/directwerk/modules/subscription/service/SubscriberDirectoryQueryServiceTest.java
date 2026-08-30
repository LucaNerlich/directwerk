package de.pnnit.directwerk.modules.subscription.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.core.entity.Role;
import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import de.pnnit.directwerk.modules.core.service.TenantUserQueryService;
import de.pnnit.directwerk.modules.core.service.TenantUserQueryService.TenantUserView;
import de.pnnit.directwerk.modules.subscription.SubscriptionModule;
import de.pnnit.directwerk.modules.subscription.entity.Subscription;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionProduct;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionSource;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionStatus;
import de.pnnit.directwerk.modules.subscription.repository.SubscriptionRepository;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.entity.User;
import java.time.Instant;
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
    private TenantUserQueryService tenantUserQueryService;

    @Mock
    private SubscriptionRepository subscriptionRepository;

    @Mock
    private ModuleGateService moduleGateService;

    @InjectMocks
    private SubscriberDirectoryQueryService service;

    @Test
    void listSubscribersSkipsSubscriptionLookupWhenModuleInactive() {
        when(tenantUserQueryService.listTenantUsers(TENANT_ID)).thenReturn(List.of(
                new TenantUserView(1L, "sub@example.com", "Sub", List.of(Role.SUBSCRIBER.name()), "ACTIVE", null, null)
        ));
        when(moduleGateService.isModuleActive(TENANT_ID, SubscriptionModule.MODULE_KEY)).thenReturn(false);

        assertThat(service.listSubscribers(TENANT_ID)).hasSize(1);
    }

    @Test
    void listSubscribersIncludesSubscriptionRecordsWhenModuleActive() {
        when(tenantUserQueryService.listTenantUsers(TENANT_ID)).thenReturn(List.of());
        when(moduleGateService.isModuleActive(TENANT_ID, SubscriptionModule.MODULE_KEY)).thenReturn(true);
        when(subscriptionRepository.findDetailedByTenantId(TENANT_ID)).thenReturn(List.of(sampleSubscription()));

        assertThat(service.listSubscribers(TENANT_ID))
                .singleElement()
                .satisfies(entry -> {
                    assertThat(entry.email()).isEqualTo("paid@example.com");
                    assertThat(entry.subscriptions()).hasSize(1);
                });
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
