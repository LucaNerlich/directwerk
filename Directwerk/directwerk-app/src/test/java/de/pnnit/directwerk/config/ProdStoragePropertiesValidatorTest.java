package de.pnnit.directwerk.config;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ProdStoragePropertiesValidatorTest {

    @Mock
    private DirectwerkConfig directwerkConfig;

    @Mock
    private DirectwerkProperties.Storage storage;

    @Test
    void rejectsDisabledStorage() {
        when(directwerkConfig.isStorageEnabled()).thenReturn(false);

        ProdStoragePropertiesValidator validator = new ProdStoragePropertiesValidator(directwerkConfig);

        assertThatThrownBy(validator::validateProductionStorage)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("DIRECTWERK_STORAGE_ENABLED");
    }

    @Test
    void rejectsMissingBucket() {
        when(directwerkConfig.isStorageEnabled()).thenReturn(true);
        when(directwerkConfig.storage()).thenReturn(storage);
        when(storage.bucket()).thenReturn(" ");

        ProdStoragePropertiesValidator validator = new ProdStoragePropertiesValidator(directwerkConfig);

        assertThatThrownBy(validator::validateProductionStorage)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("DIRECTWERK_STORAGE_BUCKET");
    }

    @Test
    void rejectsHttpPublicCdnBaseUrl() {
        when(directwerkConfig.isStorageEnabled()).thenReturn(true);
        when(directwerkConfig.storage()).thenReturn(storage);
        when(storage.bucket()).thenReturn("directwerk");
        when(storage.publicCdnBaseUrl()).thenReturn("http://cdn.example.com");

        ProdStoragePropertiesValidator validator = new ProdStoragePropertiesValidator(directwerkConfig);

        assertThatThrownBy(validator::validateProductionStorage)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("DIRECTWERK_STORAGE_PUBLIC_CDN_BASE_URL");
    }

    @Test
    void acceptsConfiguredHttpsPublicCdn() {
        when(directwerkConfig.isStorageEnabled()).thenReturn(true);
        when(directwerkConfig.storage()).thenReturn(storage);
        when(storage.bucket()).thenReturn("directwerk");
        when(storage.publicCdnBaseUrl()).thenReturn("https://cdn.example.com");

        ProdStoragePropertiesValidator validator = new ProdStoragePropertiesValidator(directwerkConfig);

        assertThatCode(validator::validateProductionStorage).doesNotThrowAnyException();
    }
}
