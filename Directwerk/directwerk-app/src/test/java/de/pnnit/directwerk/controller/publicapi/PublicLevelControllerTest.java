package de.pnnit.directwerk.controller.publicapi;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.api.dto.LevelView;
import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import de.pnnit.directwerk.modules.subscription.entity.OfferingType;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionProduct;
import de.pnnit.directwerk.modules.subscription.service.SubscriptionProductService;
import de.pnnit.directwerk.multitenancy.TenantContext;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

class PublicLevelControllerTest {

    private final SubscriptionProductService subscriptionProductService =
            mock(SubscriptionProductService.class);
    private final ModuleGateService moduleGateService = mock(ModuleGateService.class);
    private final PublicLevelController controller =
            new PublicLevelController(subscriptionProductService, moduleGateService);

    @AfterEach
    void clearTenant() {
        TenantContext.clear();
    }

    @Test
    void returnsOnlyActiveLevelProductsExcludingPackages() {
        TenantContext.setTenantId(10L);
        SubscriptionProduct bundle = product(3L, "bundle", "Bundle", OfferingType.PACKAGE, 5);
        SubscriptionProduct fan = product(1L, "fan", "Fan", OfferingType.LEVEL, 10);
        SubscriptionProduct supporter = product(2L, "supporter", "Supporter", OfferingType.LEVEL, 20);
        when(subscriptionProductService.listProducts(10L, true))
                .thenReturn(List.of(bundle, fan, supporter));

        ResponseEntity<Response<List<LevelView>>> response = controller.listLevels();

        verify(subscriptionProductService).listProducts(10L, true);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        List<LevelView> levels = response.getBody().data();
        assertThat(levels).containsExactly(
                new LevelView(1L, "fan", "Fan", 10),
                new LevelView(2L, "supporter", "Supporter", 20)
        );
    }

    @Test
    void returnsEmptyListWhenNoLevelProductsExist() {
        TenantContext.setTenantId(10L);
        when(subscriptionProductService.listProducts(10L, true))
                .thenReturn(List.of(product(3L, "bundle", "Bundle", OfferingType.PACKAGE, 5)));

        ResponseEntity<Response<List<LevelView>>> response = controller.listLevels();

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().data()).isEmpty();
    }

    private static SubscriptionProduct product(
            Long id,
            String slug,
            String title,
            OfferingType offeringType,
            int sortOrder
    ) {
        SubscriptionProduct product = new SubscriptionProduct();
        product.setId(id);
        product.setSlug(slug);
        product.setTitle(title);
        product.setOfferingType(offeringType);
        product.setSortOrder(sortOrder);
        return product;
    }
}
