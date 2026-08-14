package de.pnnit.directwerk.multitenancy;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class TenantContextTest {

    @AfterEach
    void clear() {
        TenantContext.clear();
    }

    @Test
    void requireTenantIdFailsWhenMissing() {
        assertThatThrownBy(TenantContext::requireTenantId)
                .isInstanceOf(TenantContextMissingException.class);
    }

    @Test
    void callWithoutTenantRestoresPrevious() {
        TenantContext.setTenantId(7L);
        Long observed = TenantContext.callWithoutTenant(TenantContext::getTenantId);
        assertThat(observed).isNull();
        assertThat(TenantContext.getTenantId()).isEqualTo(7L);
    }

    @Test
    void runWithTenantRestoresPrevious() {
        TenantContext.setTenantId(1L);
        TenantContext.runWithTenant(2L, () -> assertThat(TenantContext.getTenantId()).isEqualTo(2L));
        assertThat(TenantContext.getTenantId()).isEqualTo(1L);
    }
}
