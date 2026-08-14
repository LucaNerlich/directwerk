package de.pnnit.directwerk.modules.core.util;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class TenantAssetKeysTest {

    @Test
    void acceptsTenantPrefixedKey() {
        assertThat(TenantAssetKeys.requireTenantPrefix("alpha", "alpha/public/cover.jpg"))
                .isEqualTo("alpha/public/cover.jpg");
    }

    @Test
    void rejectsCrossTenantKey() {
        assertThatThrownBy(() -> TenantAssetKeys.requireTenantPrefix("alpha", "beta/public/cover.jpg"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void buildsScopedKeys() {
        assertThat(TenantAssetKeys.stagingKey("alpha", "upload.bin"))
                .isEqualTo("alpha/staging/upload.bin");
    }

    @Test
    void rejectsTraversalSegments() {
        assertThatThrownBy(() -> TenantAssetKeys.requireTenantPrefix("alpha", "alpha/../beta/file.txt"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Invalid object key");
    }

    @Test
    void rejectsNullTenant() {
        assertThatThrownBy(() -> TenantAssetKeys.requireTenantPrefix(null, "alpha/public/file.txt"))
                .isInstanceOf(NullPointerException.class)
                .hasMessageContaining("tenantSlug");
    }

    @Test
    void rejectsNullKey() {
        assertThatThrownBy(() -> TenantAssetKeys.requireTenantPrefix("alpha", null))
                .isInstanceOf(NullPointerException.class)
                .hasMessageContaining("objectKey");
    }

    @Test
    void rejectsEmptyTenant() {
        assertThatThrownBy(() -> TenantAssetKeys.requireTenantPrefix("", "alpha/public/file.txt"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("required");
    }

    @Test
    void rejectsEmptyKey() {
        assertThatThrownBy(() -> TenantAssetKeys.requireTenantPrefix("alpha", ""))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("required");
    }

    @Test
    void acceptsSpecialCharactersInPath() {
        assertThat(TenantAssetKeys.requireTenantPrefix("alpha", "alpha/public/file-name_123.jpg"))
                .isEqualTo("alpha/public/file-name_123.jpg");
    }
}
