package de.pnnit.directwerk.modules.digital;

import static org.assertj.core.api.Assertions.assertThat;

import de.pnnit.directwerk.bootstrap.S3StorageHealthIndicator;
import de.pnnit.directwerk.modules.digital.api.MediaAssetLifecycleApi;
import de.pnnit.directwerk.modules.digital.api.UploadApi;
import de.pnnit.directwerk.modules.digital.service.MediaAssetLifecycleService;
import de.pnnit.directwerk.modules.digital.service.UploadService;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.TestPropertySource;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

/**
 * Regression: enabling storage must wire {@link UploadService} as {@link UploadApi}.
 * A {@code @ConditionalOnBean(S3Client)} on the scanned service previously left no
 * UploadApi when S3 beans were registered later in the same context refresh.
 */
@SpringBootTest
@ActiveProfiles("test")
@TestPropertySource(properties = {
        "directwerk.storage.enabled=true",
        "directwerk.storage.provider=bunny",
        "directwerk.storage.region=de",
        "directwerk.storage.bucket=directwerk-test",
        "directwerk.storage.endpoint=https://de-s3.storage.bunnycdn.com",
        "directwerk.storage.force-path-style=true",
        "directwerk.storage.public-cdn-base-url=https://cdn.example.test"
})
class StorageEnabledContextTest {

    @DynamicPropertySource
    static void registerEphemeralSecrets(DynamicPropertyRegistry registry) {
        registry.add(
                "directwerk.security.platform-client-secret",
                () -> "test-platform-" + UUID.randomUUID()
        );
        registry.add(
                "directwerk.security.tenant-client-secret",
                () -> "test-tenant-" + UUID.randomUUID()
        );
        registry.add(
                "directwerk.storage.access-key",
                () -> "test-access-" + UUID.randomUUID()
        );
        registry.add(
                "directwerk.storage.secret-key",
                () -> "test-secret-" + UUID.randomUUID()
        );
    }

    @Autowired
    private UploadApi uploadApi;

    @Autowired
    private MediaAssetLifecycleApi mediaAssetLifecycleApi;

    @Autowired
    private S3Client s3Client;

    @Autowired
    private S3Presigner s3Presigner;

    @Autowired
    private S3StorageHealthIndicator s3StorageHealthIndicator;

    @Test
    void wiresUploadServiceWhenStorageEnabled() {
        assertThat(uploadApi).isInstanceOf(UploadService.class);
        assertThat(mediaAssetLifecycleApi).isInstanceOf(MediaAssetLifecycleService.class);
        assertThat(s3Client).isNotNull();
        assertThat(s3Presigner).isNotNull();
        assertThat(s3StorageHealthIndicator).isNotNull();
    }
}
