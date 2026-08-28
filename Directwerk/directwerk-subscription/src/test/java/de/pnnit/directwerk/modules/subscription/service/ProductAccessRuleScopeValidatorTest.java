package de.pnnit.directwerk.modules.subscription.service;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import de.pnnit.directwerk.modules.content.api.ContentScopeLookupApi;
import de.pnnit.directwerk.modules.subscription.entity.ProductAccessScopeType;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ProductAccessRuleScopeValidatorTest {

    @Mock
    private ContentScopeLookupApi contentScopeLookupApi;

    @InjectMocks
    private ProductAccessRuleScopeValidator validator;

    @Test
    void validatesPodcastSeriesScope() {
        validator.validateScope(10L, ProductAccessScopeType.PODCAST_SERIES, 5L);
        verify(contentScopeLookupApi).requirePodcastSeries(10L, 5L);
    }

    @Test
    void validatesFormatScope() {
        validator.validateScope(10L, ProductAccessScopeType.FORMAT, 3L);
        verify(contentScopeLookupApi).requireFormat(10L, 3L);
    }

    @Test
    void validatesCategoryScope() {
        validator.validateScope(10L, ProductAccessScopeType.CATEGORY, 7L);
        verify(contentScopeLookupApi).requireCategory(10L, 7L);
    }

    @Test
    void validatesDigitalAssetScope() {
        validator.validateScope(10L, ProductAccessScopeType.DIGITAL_ASSET, 99L);
        verify(contentScopeLookupApi).requireDigitalAsset(10L, 99L);
    }

    @Test
    void skipsLookupForAllPodcasts() {
        validator.validateScope(10L, ProductAccessScopeType.ALL_PODCASTS, null);
        verifyNoInteractions(contentScopeLookupApi);
    }
}
