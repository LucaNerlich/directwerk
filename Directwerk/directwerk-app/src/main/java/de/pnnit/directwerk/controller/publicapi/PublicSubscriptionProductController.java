package de.pnnit.directwerk.controller.publicapi;

import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import de.pnnit.directwerk.modules.subscription.SubscriptionModule;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionProduct;
import de.pnnit.directwerk.modules.subscription.service.SubscriptionProductService;
import de.pnnit.directwerk.multitenancy.TenantContext;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/public/products")
public class PublicSubscriptionProductController {

    private final SubscriptionProductService subscriptionProductService;
    private final ModuleGateService moduleGateService;

    public PublicSubscriptionProductController(
            SubscriptionProductService subscriptionProductService,
            ModuleGateService moduleGateService
    ) {
        this.subscriptionProductService = subscriptionProductService;
        this.moduleGateService = moduleGateService;
    }

    @GetMapping
    ResponseEntity<Response<List<ProductView>>> listActiveProducts() {
        moduleGateService.requireModule(SubscriptionModule.MODULE_KEY);
        Long tenantId = TenantContext.getTenantId();

        List<ProductView> products = subscriptionProductService.listProducts(tenantId, true).stream()
                .map(PublicSubscriptionProductController::toView)
                .toList();
        return ResponseEntity.ok(Response.ok(products));
    }

    private static ProductView toView(SubscriptionProduct product) {
        return new ProductView(
                product.getSlug(),
                product.getTitle(),
                product.getOfferingType().name(),
                product.getSortOrder(),
                product.getDescription(),
                product.getPriceCents(),
                product.getCurrency(),
                product.getBillingInterval().name()
        );
    }

    public record ProductView(
            String slug,
            String title,
            String offeringType,
            int sortOrder,
            String description,
            Integer priceCents,
            String currency,
            String billingInterval
    ) {
    }
}
