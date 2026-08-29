package de.pnnit.directwerk.modules.stripebilling;

import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.subscription.SubscriptionModule;
import de.pnnit.directwerk.modules.subscription.entity.BillingInterval;
import de.pnnit.directwerk.modules.subscription.entity.Subscription;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionProduct;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionSource;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionStatus;
import de.pnnit.directwerk.modules.subscription.service.SubscriptionService;
import java.time.Clock;
import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.Comparator;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BillingDashboardService {

    private final SubscriptionService subscriptionService;
    private final StripeConnectService stripeConnectService;
    private final Clock clock;

    public BillingDashboardService(
            SubscriptionService subscriptionService,
            StripeConnectService stripeConnectService,
            Clock clock
    ) {
        this.subscriptionService = subscriptionService;
        this.stripeConnectService = stripeConnectService;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    @RequiresModule(SubscriptionModule.MODULE_KEY)
    public BillingDashboard snapshot(Long tenantId) {
        List<Subscription> subscriptions = subscriptionService.listSubscriptionsForTenant(tenantId);
        YearMonth month = YearMonth.now(clock.withZone(ZoneOffset.UTC));
        Instant monthStart = month.atDay(1).atStartOfDay().toInstant(ZoneOffset.UTC);
        Instant nextMonthStart = month.plusMonths(1).atDay(1).atStartOfDay().toInstant(ZoneOffset.UTC);

        long active = subscriptions.stream().filter(this::isActive).count();
        long paid = subscriptions.stream()
                .filter(this::isActive)
                .filter((subscription) -> subscription.getSource() == SubscriptionSource.STRIPE)
                .count();
        long grants = subscriptions.stream()
                .filter(this::isActive)
                .filter((subscription) -> subscription.getSource() != SubscriptionSource.STRIPE)
                .count();
        long uniqueMembers = subscriptions.stream()
                .filter(this::isActive)
                .map((subscription) -> subscription.getUser().getId())
                .distinct()
                .count();
        long newThisMonth = subscriptions.stream()
                .filter((subscription) -> subscription.getStartedAt() != null)
                .filter((subscription) -> !subscription.getStartedAt().isBefore(monthStart)
                        && subscription.getStartedAt().isBefore(nextMonthStart))
                .count();
        long canceledThisMonth = subscriptions.stream()
                .filter((subscription) -> subscription.getStatus() == SubscriptionStatus.CANCELED)
                .filter((subscription) -> subscription.getUpdatedAt() != null)
                .filter((subscription) -> !subscription.getUpdatedAt().isBefore(monthStart)
                        && subscription.getUpdatedAt().isBefore(nextMonthStart))
                .count();
        long pastDue = subscriptions.stream()
                .filter((subscription) -> subscription.getStatus() == SubscriptionStatus.PAST_DUE)
                .count();
        long incomplete = subscriptions.stream()
                .filter((subscription) -> subscription.getStatus() == SubscriptionStatus.INCOMPLETE)
                .count();
        int estimatedMonthlyCents = subscriptions.stream()
                .filter(this::isActive)
                .filter((subscription) -> subscription.getSource() == SubscriptionSource.STRIPE)
                .mapToInt(this::monthlyCents)
                .sum();
        String currency = subscriptions.stream()
                .map(Subscription::getProduct)
                .map(SubscriptionProduct::getCurrency)
                .filter((value) -> value != null && !value.isBlank())
                .findFirst()
                .orElse("EUR");

        List<MembershipRow> memberships = subscriptions.stream()
                .sorted(Comparator
                        .comparingInt(this::statusRank)
                        .thenComparing(Subscription::getStartedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(100)
                .map(this::toRow)
                .toList();

        return new BillingDashboard(
                stripeConnectService.status(tenantId),
                new BillingStats(
                        active,
                        paid,
                        grants,
                        uniqueMembers,
                        newThisMonth,
                        canceledThisMonth,
                        pastDue,
                        incomplete,
                        subscriptions.size(),
                        estimatedMonthlyCents,
                        currency
                ),
                memberships
        );
    }

    private boolean isActive(Subscription subscription) {
        return subscription.getStatus() == SubscriptionStatus.ACTIVE;
    }

    private int statusRank(Subscription subscription) {
        return switch (subscription.getStatus()) {
            case PAST_DUE -> 0;
            case INCOMPLETE -> 1;
            case ACTIVE -> 2;
            default -> 3;
        };
    }

    private int monthlyCents(Subscription subscription) {
        SubscriptionProduct product = subscription.getProduct();
        if (product.getPriceCents() == null || product.getPriceCents() <= 0) {
            return 0;
        }
        if (product.getBillingInterval() == BillingInterval.YEAR) {
            return product.getPriceCents() / 12;
        }
        if (product.getBillingInterval() == BillingInterval.MONTH) {
            return product.getPriceCents();
        }
        return 0;
    }

    private MembershipRow toRow(Subscription subscription) {
        SubscriptionProduct product = subscription.getProduct();
        return new MembershipRow(
                subscription.getId(),
                subscription.getUser().getId(),
                subscription.getUser().getEmail(),
                product.getId(),
                product.getSlug(),
                product.getTitle(),
                subscription.getStatus().name(),
                subscription.getSource().name(),
                subscription.getStartedAt(),
                subscription.getEndsAt(),
                subscription.getExternalSubscriptionId()
        );
    }

    public record BillingDashboard(
            StripeConnectService.StripeStatusSnapshot stripe,
            BillingStats stats,
            List<MembershipRow> memberships
    ) {
    }

    public record BillingStats(
            long activeSubscriptions,
            long activePaidSubscriptions,
            long activeGrantSubscriptions,
            long uniqueActiveMembers,
            long newThisMonth,
            long canceledThisMonth,
            long pastDueSubscriptions,
            long incompleteSubscriptions,
            long totalMemberships,
            int estimatedMonthlyCents,
            String currency
    ) {
    }

    public record MembershipRow(
            Long id,
            Long userId,
            String email,
            Long productId,
            String productSlug,
            String productTitle,
            String status,
            String source,
            Instant startedAt,
            Instant endsAt,
            String externalSubscriptionId
    ) {
    }
}
