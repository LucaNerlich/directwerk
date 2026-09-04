package de.pnnit.directwerk.modules.stripebilling;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.core.entity.User;
import de.pnnit.directwerk.modules.subscription.entity.BillingInterval;
import de.pnnit.directwerk.modules.subscription.entity.Subscription;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionProduct;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionSource;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionStatus;
import de.pnnit.directwerk.modules.subscription.service.SubscriptionService;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class BillingDashboardExpiryTest {

    @Mock
    private SubscriptionService subscriptionService;

    @Mock
    private StripeConnectService stripeConnectService;

    @Test
    void excludesExpiredActiveRowsFromActiveCountsAndMrr() {
        Clock clock = Clock.fixed(Instant.parse("2026-08-13T12:00:00Z"), ZoneOffset.UTC);
        BillingDashboardService service = new BillingDashboardService(
                subscriptionService,
                stripeConnectService,
                clock
        );
        when(subscriptionService.listSubscriptionsForTenant(4L)).thenReturn(List.of(
                subscription(1L, 10L, SubscriptionStatus.ACTIVE, SubscriptionSource.STRIPE, 990,
                        BillingInterval.MONTH, "2026-08-02T10:00:00Z", null),
                subscription(2L, 11L, SubscriptionStatus.ACTIVE, SubscriptionSource.STRIPE, 990,
                        BillingInterval.MONTH, "2026-07-01T10:00:00Z", "2026-08-01T00:00:00Z"),
                subscription(3L, 12L, SubscriptionStatus.ACTIVE, SubscriptionSource.MANUAL, 0,
                        BillingInterval.MONTH, "2026-08-05T10:00:00Z", null)
        ));
        when(stripeConnectService.status(4L)).thenReturn(new StripeConnectService.StripeStatusSnapshot(
                "CONNECTED", true, "ok", true, true, true
        ));

        BillingDashboardService.BillingDashboard dashboard = service.snapshot(4L);

        assertEquals(2, dashboard.stats().activeSubscriptions());
        assertEquals(1, dashboard.stats().activePaidSubscriptions());
        assertEquals(1, dashboard.stats().activeGrantSubscriptions());
        assertEquals(2, dashboard.stats().uniqueActiveMembers());
        assertEquals(990, dashboard.stats().estimatedMonthlyCents());
    }

    @Test
    void roundsYearlyPricesToNearestCent() {
        Clock clock = Clock.fixed(Instant.parse("2026-08-13T12:00:00Z"), ZoneOffset.UTC);
        BillingDashboardService service = new BillingDashboardService(
                subscriptionService,
                stripeConnectService,
                clock
        );
        when(subscriptionService.listSubscriptionsForTenant(4L)).thenReturn(List.of(
                subscription(1L, 10L, SubscriptionStatus.ACTIVE, SubscriptionSource.STRIPE, 18,
                        BillingInterval.YEAR, "2026-08-02T10:00:00Z", null)
        ));
        when(stripeConnectService.status(4L)).thenReturn(new StripeConnectService.StripeStatusSnapshot(
                "CONNECTED", true, "ok", true, true, true
        ));

        BillingDashboardService.BillingDashboard dashboard = service.snapshot(4L);

        assertEquals(2, dashboard.stats().estimatedMonthlyCents());
    }

    private static Subscription subscription(
            Long id,
            Long userId,
            SubscriptionStatus status,
            SubscriptionSource source,
            int priceCents,
            BillingInterval interval,
            String startedAt,
            String endsAt
    ) {
        User user = new User();
        user.setId(userId);
        user.setEmail("user" + userId + "@example.com");
        SubscriptionProduct product = new SubscriptionProduct();
        product.setId(id);
        product.setSlug("p" + id);
        product.setTitle("Product " + id);
        product.setPriceCents(priceCents);
        product.setCurrency("EUR");
        product.setBillingInterval(interval);
        Subscription subscription = new Subscription();
        subscription.setId(id);
        subscription.setUser(user);
        subscription.setProduct(product);
        subscription.setStatus(status);
        subscription.setSource(source);
        subscription.setStartedAt(Instant.parse(startedAt));
        subscription.setUpdatedAt(Instant.parse(startedAt));
        subscription.setEndsAt(endsAt == null ? null : Instant.parse(endsAt));
        return subscription;
    }
}
