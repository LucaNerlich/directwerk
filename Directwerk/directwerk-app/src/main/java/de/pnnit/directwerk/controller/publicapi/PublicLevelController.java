package de.pnnit.directwerk.controller.publicapi;

import de.pnnit.directwerk.api.dto.LevelView;
import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.subscription.SubscriptionModule;
import de.pnnit.directwerk.modules.subscription.entity.OfferingType;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionProduct;
import de.pnnit.directwerk.modules.subscription.service.SubscriptionProductService;
import de.pnnit.directwerk.multitenancy.TenantContext;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/public/levels")
@RequiresModule(SubscriptionModule.MODULE_KEY)
public class PublicLevelController {

    private final SubscriptionProductService subscriptionProductService;

    public PublicLevelController(
            SubscriptionProductService subscriptionProductService
    ) {
        this.subscriptionProductService = subscriptionProductService;
    }

    @GetMapping
    ResponseEntity<Response<List<LevelView>>> listLevels() {
        Long tenantId = TenantContext.getTenantId();

        List<LevelView> levels = subscriptionProductService.listProducts(tenantId, true).stream()
                .filter(product -> product.getOfferingType() == OfferingType.LEVEL)
                .map(PublicLevelController::toView)
                .toList();
        return ResponseEntity.ok(Response.ok(levels));
    }

    private static LevelView toView(SubscriptionProduct product) {
        return new LevelView(
                product.getId(),
                product.getSlug(),
                product.getTitle(),
                product.getSortOrder()
        );
    }
}
