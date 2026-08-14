package de.pnnit.directwerk.multitenancy;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionProduct;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class TenantWriteGuardListenerTest {

    private final TenantWriteGuardListener listener = new TenantWriteGuardListener();

    @AfterEach
    void clear() {
        TenantContext.clear();
    }

    @Test
    void rejectsWriteForDifferentTenant() {
        TenantContext.setTenantId(1L);
        Tenant other = new Tenant();
        other.setId(2L);
        SubscriptionProduct product = new SubscriptionProduct();
        product.setTenant(other);

        assertThatThrownBy(() -> listener.enforceTenant(product))
                .isInstanceOf(TenantMismatchException.class);
    }

    @Test
    void allowsWriteWhenContextMatches() {
        TenantContext.setTenantId(1L);
        Tenant tenant = new Tenant();
        tenant.setId(1L);
        SubscriptionProduct product = new SubscriptionProduct();
        product.setTenant(tenant);

        assertThatCode(() -> listener.enforceTenant(product)).doesNotThrowAnyException();
    }

    @Test
    void allowsWriteWhenContextAbsent() {
        Tenant other = new Tenant();
        other.setId(2L);
        SubscriptionProduct product = new SubscriptionProduct();
        product.setTenant(other);

        assertThatCode(() -> listener.enforceTenant(product)).doesNotThrowAnyException();
    }
}
