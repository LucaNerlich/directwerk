package de.pnnit.directwerk.modules.subscription.repository;

import static org.assertj.core.api.Assertions.assertThat;

import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.entity.TenantStatus;
import de.pnnit.directwerk.modules.core.entity.User;
import de.pnnit.directwerk.modules.subscription.entity.Subscription;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionProduct;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionStatus;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;
import org.springframework.test.context.ActiveProfiles;

/**
 * Issue #537: deactivating a product is catalog visibility only; an already-purchased ACTIVE
 * subscription must keep granting.
 */
@DataJpaTest
@ActiveProfiles("test")
class SubscriptionRepositoryTest {

    @Autowired
    private SubscriptionRepository subscriptionRepository;

    @Autowired
    private TestEntityManager entityManager;

    @Test
    void activeSubscriptionKeepsGrantingAfterItsProductIsDeactivated() {
        Tenant tenant = persistTenant();
        User user = persistUser();
        SubscriptionProduct product = persistProduct(tenant, false);
        persistSubscription(tenant, user, product, SubscriptionStatus.ACTIVE);
        entityManager.flush();
        entityManager.clear();

        assertThat(subscriptionRepository.findActiveWithProducts(tenant.getId(), user.getId(), SubscriptionStatus.ACTIVE))
                .extracting(subscription -> subscription.getProduct().getId())
                .containsExactly(product.getId());
    }

    @Test
    void cancelledSubscriptionNeverGrantsEvenForAnActiveProduct() {
        Tenant tenant = persistTenant();
        User user = persistUser();
        SubscriptionProduct product = persistProduct(tenant, true);
        persistSubscription(tenant, user, product, SubscriptionStatus.CANCELED);
        entityManager.flush();
        entityManager.clear();

        assertThat(subscriptionRepository.findActiveWithProducts(tenant.getId(), user.getId(), SubscriptionStatus.ACTIVE))
                .isEmpty();
    }

    private Tenant persistTenant() {
        Tenant tenant = new Tenant();
        tenant.setSlug("alpha");
        tenant.setName("Alpha");
        tenant.setStatus(TenantStatus.ACTIVE);
        return entityManager.persist(stamp(tenant));
    }

    private User persistUser() {
        User user = new User();
        user.setEmail("subscriber@example.test");
        user.setName("Subscriber");
        return entityManager.persist(stamp(user));
    }

    private SubscriptionProduct persistProduct(Tenant tenant, boolean active) {
        SubscriptionProduct product = new SubscriptionProduct();
        product.setTenant(tenant);
        product.setSlug("supporter-" + active);
        product.setTitle("Supporter");
        product.setSortOrder(1);
        product.setActive(active);
        return entityManager.persist(stamp(product));
    }

    /** {@code @DataJpaTest} does not enable Spring Data auditing, so stamp the audit columns. */
    private static <T extends de.pnnit.directwerk.modules.core.entity.Auditable> T stamp(T entity) {
        Instant now = Instant.parse("2026-01-01T00:00:00Z");
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        return entity;
    }

    private void persistSubscription(
            Tenant tenant,
            User user,
            SubscriptionProduct product,
            SubscriptionStatus status
    ) {
        Subscription subscription = new Subscription();
        subscription.setTenant(tenant);
        subscription.setUser(user);
        subscription.setProduct(product);
        subscription.setStatus(status);
        subscription.setStartedAt(Instant.parse("2026-01-01T00:00:00Z"));
        entityManager.persist(stamp(subscription));
    }
}
