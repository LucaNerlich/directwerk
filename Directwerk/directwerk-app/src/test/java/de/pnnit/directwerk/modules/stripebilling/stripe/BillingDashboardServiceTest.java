package de.pnnit.directwerk.modules.stripebilling.stripe;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.core.entity.User;
import de.pnnit.directwerk.modules.subscription.entity.BillingInterval;
import de.pnnit.directwerk.modules.subscription.entity.Subscription;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionProduct;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionSource;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionStatus;
import de.pnnit.directwerk.modules.stripebilling.BillingDashboardService;
import de.pnnit.directwerk.modules.stripebilling.StripeConnectService;
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
class BillingDashboardServiceTest {

    @Mock
    private SubscriptionService subscriptionService;

    @Mock
    private StripeConnectService stripeConnectService;

    @Test
    void computesMemberAndRevenueStatsFromLocalRows() {
        Clock clock = Clock.fixed(Instant.parse("2026-08-13T12:00:00Z"), ZoneOffset.UTC);
        BillingDashboardService service = new BillingDashboardService(
                subscriptionService,
                stripeConnectService,
                clock
        );
        when(subscriptionService.listSubscriptionsForTenant(4L)).thenReturn(List.of(
                subscription(1L, 10L, SubscriptionStatus.ACTIVE, SubscriptionSource.STRIPE, 990, BillingInterval.MONTH, "2026-08-02T10:00:00Z"),
                subscription(2L, 11L, SubscriptionStatus.ACTIVE, SubscriptionSource.MANUAL, 0, BillingInterval.MONTH, "2026-07-01T10:00:00Z"),
                subscription(3L, 10L, SubscriptionStatus.CANCELED, SubscriptionSource.STRIPE, 12000, BillingInterval.YEAR, "2026-08-05T10:00:00Z"),
                subscription(4L, 12L, SubscriptionStatus.PAST_DUE, SubscriptionSource.STRIPE, 1490, BillingInterval.MONTH, "2026-06-01T10:00:00Z")
        ));
        when(stripeConnectService.status(4L)).thenReturn(new StripeConnectService.StripeStatusSnapshot(
                "CONNECTED",
                true,
                "ok",
                true,
                true,
                true
        ));

        BillingDashboardService.BillingDashboard dashboard = service.snapshot(4L);

        assertThat(dashboard.stats().activeSubscriptions()).isEqualTo(2);
        assertThat(dashboard.stats().activePaidSubscriptions()).isEqualTo(1);
        assertThat(dashboard.stats().activeGrantSubscriptions()).isEqualTo(1);
        assertThat(dashboard.stats().uniqueActiveMembers()).isEqualTo(2);
        assertThat(dashboard.stats().newThisMonth()).isEqualTo(2);
        assertThat(dashboard.stats().canceledThisMonth()).isEqualTo(1);
        assertThat(dashboard.stats().pastDueSubscriptions()).isEqualTo(1);
        assertThat(dashboard.stats().incompleteSubscriptions()).isEqualTo(0);
        assertThat(dashboard.stats().totalMemberships()).isEqualTo(4);
        assertThat(dashboard.stats().monthlyTotals()).containsExactly(new BillingDashboardService.MonthlyTotal("EUR", 990));
        // Deprecated v1 fields stay populated for a single currency.
        assertThat(dashboard.stats().estimatedMonthlyCents()).isEqualTo(990);
        assertThat(dashboard.stats().currency()).isEqualTo("EUR");
        assertThat(dashboard.stripe().status()).isEqualTo("CONNECTED");
        assertThat(dashboard.memberships()).hasSize(4);
        assertThat(dashboard.memberships().getFirst().status()).isEqualTo("PAST_DUE");
    }

    @Test
    void keepsMonthlyTotalsPerCurrencyAndLeavesTheV1FieldsEmpty() {
        Clock clock = Clock.fixed(Instant.parse("2026-08-13T12:00:00Z"), ZoneOffset.UTC);
        BillingDashboardService service = new BillingDashboardService(
                subscriptionService,
                stripeConnectService,
                clock
        );
        when(subscriptionService.listSubscriptionsForTenant(4L)).thenReturn(List.of(
                subscription(1L, 10L, SubscriptionStatus.ACTIVE, SubscriptionSource.STRIPE, 990, BillingInterval.MONTH, "2026-08-02T10:00:00Z", "EUR"),
                subscription(2L, 11L, SubscriptionStatus.ACTIVE, SubscriptionSource.STRIPE, 500, BillingInterval.MONTH, "2026-08-03T10:00:00Z", "USD")
        ));
        when(stripeConnectService.status(4L)).thenReturn(new StripeConnectService.StripeStatusSnapshot(
                "CONNECTED", true, "ok", true, true, true
        ));

        BillingDashboardService.BillingDashboard dashboard = service.snapshot(4L);

        assertThat(dashboard.stats().monthlyTotals()).containsExactlyInAnyOrder(
                new BillingDashboardService.MonthlyTotal("EUR", 990),
                new BillingDashboardService.MonthlyTotal("USD", 500)
        );
        assertThat(dashboard.stats().estimatedMonthlyCents()).isZero();
        assertThat(dashboard.stats().currency()).isNull();
    }

    private static Subscription subscription(
            Long id,
            Long userId,
            SubscriptionStatus status,
            SubscriptionSource source,
            int priceCents,
            BillingInterval interval,
            String startedAt
    ) {
        return subscription(id, userId, status, source, priceCents, interval, startedAt, "EUR");
    }

    private static Subscription subscription(
            Long id,
            Long userId,
            SubscriptionStatus status,
            SubscriptionSource source,
            int priceCents,
            BillingInterval interval,
            String startedAt,
            String currency
    ) {
        User user = new User();
        user.setId(userId);
        user.setEmail("user" + userId + "@example.com");
        SubscriptionProduct product = new SubscriptionProduct();
        product.setId(id);
        product.setSlug("p" + id);
        product.setTitle("Product " + id);
        product.setPriceCents(priceCents);
        product.setCurrency(currency);
        product.setBillingInterval(interval);
        Subscription subscription = new Subscription();
        subscription.setId(id);
        subscription.setUser(user);
        subscription.setProduct(product);
        subscription.setStatus(status);
        subscription.setSource(source);
        subscription.setStartedAt(Instant.parse(startedAt));
        subscription.setUpdatedAt(Instant.parse(startedAt));
        return subscription;
    }
}
