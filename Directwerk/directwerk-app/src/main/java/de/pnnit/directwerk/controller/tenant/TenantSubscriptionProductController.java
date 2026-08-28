package de.pnnit.directwerk.controller.tenant;

import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.subscription.SubscriptionModule;
import de.pnnit.directwerk.modules.subscription.entity.BillingInterval;
import de.pnnit.directwerk.modules.subscription.entity.OfferingType;
import de.pnnit.directwerk.modules.subscription.entity.ProductAccessRule;
import de.pnnit.directwerk.modules.subscription.entity.ProductAccessScopeType;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionProduct;
import de.pnnit.directwerk.modules.subscription.service.ProductAccessRuleService;
import de.pnnit.directwerk.modules.subscription.service.SubscriptionProductService;
import de.pnnit.directwerk.modules.subscription.stripe.StripeCatalogSyncService;
import de.pnnit.directwerk.multitenancy.TenantContext;
import de.pnnit.directwerk.modules.subscription.service.ProductAccessRuleScopeValidator;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiresModule(SubscriptionModule.MODULE_KEY)
@PreAuthorize("hasRole('TENANT_ADMIN')")
@RequestMapping("/api/v1/tenant/products")
public class TenantSubscriptionProductController {

    private final SubscriptionProductService subscriptionProductService;
    private final ProductAccessRuleService productAccessRuleService;
    private final ProductAccessRuleScopeValidator productAccessRuleScopeValidator;
    private final StripeCatalogSyncService stripeCatalogSyncService;

    public TenantSubscriptionProductController(
            SubscriptionProductService subscriptionProductService,
            ProductAccessRuleService productAccessRuleService,
            ProductAccessRuleScopeValidator productAccessRuleScopeValidator,
            StripeCatalogSyncService stripeCatalogSyncService
    ) {
        this.subscriptionProductService = subscriptionProductService;
        this.productAccessRuleService = productAccessRuleService;
        this.productAccessRuleScopeValidator = productAccessRuleScopeValidator;
        this.stripeCatalogSyncService = stripeCatalogSyncService;
    }

    @GetMapping
    ResponseEntity<Response<List<ProductView>>> listProducts() {
        Long tenantId = TenantContext.requireTenantId();
        List<ProductView> products = subscriptionProductService.listProducts(tenantId, false).stream()
                .map(TenantSubscriptionProductController::toView)
                .toList();
        return ResponseEntity.ok(Response.ok(products));
    }

    @PostMapping
    ResponseEntity<Response<ProductView>> createProduct(@Valid @RequestBody CreateProductRequest request) {
        Long tenantId = TenantContext.requireTenantId();
                SubscriptionProduct product = subscriptionProductService.createProduct(
                tenantId,
                request.slug(),
                request.title(),
                request.sortOrder(),
                request.offeringType(),
                request.description(),
                request.priceCents(),
                request.currency(),
                request.billingInterval()
        );
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(Response.created(toView(product)));
    }

    @PutMapping("/{productId}")
    ResponseEntity<Response<ProductView>> updateProduct(
            @PathVariable Long productId,
            @Valid @RequestBody UpdateProductRequest request
    ) {
        Long tenantId = TenantContext.requireTenantId();
        SubscriptionProduct product = subscriptionProductService.updateProduct(
                tenantId,
                productId,
                request.title(),
                request.sortOrder(),
                request.active(),
                request.description(),
                request.priceCents(),
                request.currency(),
                request.billingInterval()
        );
        return ResponseEntity.ok(Response.ok(toView(product)));
    }

    @PostMapping("/{productId}/sync-stripe")
    ResponseEntity<Response<ProductView>> syncStripe(@PathVariable Long productId) {
        Long tenantId = TenantContext.requireTenantId();
        SubscriptionProduct product = stripeCatalogSyncService.syncProduct(tenantId, productId);
        return ResponseEntity.ok(Response.ok(toView(product)));
    }

    @GetMapping("/{productId}/rules")
    ResponseEntity<Response<List<ProductAccessRuleView>>> listRules(@PathVariable Long productId) {
        Long tenantId = TenantContext.requireTenantId();
        List<ProductAccessRuleView> rules = productAccessRuleService.listRules(tenantId, productId).stream()
                .map(TenantSubscriptionProductController::toRuleView)
                .toList();
        return ResponseEntity.ok(Response.ok(rules));
    }

    @PutMapping("/{productId}/rules")
    ResponseEntity<Response<List<ProductAccessRuleView>>> replaceRules(
            @PathVariable Long productId,
            @Valid @RequestBody ReplaceRulesRequest request
    ) {
        Long tenantId = TenantContext.requireTenantId();
        List<ProductAccessRuleService.RuleInput> inputs = request.rules() == null ? List.of() : request.rules().stream()
                .map(rule -> {
                    productAccessRuleScopeValidator.validateScope(tenantId, rule.scopeType(), rule.scopeId());
                    return new ProductAccessRuleService.RuleInput(rule.scopeType(), rule.scopeId());
                })
                .toList();
        List<ProductAccessRuleView> rules = productAccessRuleService.replaceRules(tenantId, productId, inputs).stream()
                .map(TenantSubscriptionProductController::toRuleView)
                .toList();
        return ResponseEntity.ok(Response.ok(rules));
    }

    @DeleteMapping("/{productId}")
    ResponseEntity<Response<ProductView>> deactivateProduct(@PathVariable Long productId) {
        Long tenantId = TenantContext.requireTenantId();
        SubscriptionProduct product = subscriptionProductService.deactivateProduct(tenantId, productId);
        return ResponseEntity.ok(Response.ok(toView(product)));
    }

    private static ProductView toView(SubscriptionProduct product) {
        return new ProductView(
                product.getId(),
                product.getSlug(),
                product.getTitle(),
                product.getOfferingType().name(),
                product.getSortOrder(),
                product.isActive(),
                product.getDescription(),
                product.getPriceCents(),
                product.getCurrency(),
                product.getBillingInterval().name(),
                product.getStripeProductId(),
                product.getStripePriceId()
        );
    }

    private static ProductAccessRuleView toRuleView(ProductAccessRule rule) {
        return new ProductAccessRuleView(
                rule.getId(),
                rule.getProduct().getId(),
                rule.getScopeType().name(),
                rule.getScopeId(),
                rule.getEffect().name(),
                rule.getCreatedAt()
        );
    }

    public record CreateProductRequest(
            @NotBlank
            @Pattern(regexp = "^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,62}[a-zA-Z0-9])?$")
            String slug,
            @NotBlank @Size(max = 255) String title,
            @Min(0) Integer sortOrder,
            OfferingType offeringType,
            @Size(max = 2000) String description,
            @Min(0) Integer priceCents,
            @Size(min = 3, max = 3) String currency,
            BillingInterval billingInterval
    ) {
    }

    public record UpdateProductRequest(
            @Size(max = 255) String title,
            @Min(0) Integer sortOrder,
            Boolean active,
            @Size(max = 2000) String description,
            @Min(0) Integer priceCents,
            @Size(min = 3, max = 3) String currency,
            BillingInterval billingInterval
    ) {
    }

    public record ProductView(
            Long id,
            String slug,
            String title,
            String offeringType,
            int sortOrder,
            boolean active,
            String description,
            Integer priceCents,
            String currency,
            String billingInterval,
            String stripeProductId,
            String stripePriceId
    ) {
    }

    public record ReplaceRulesRequest(List<@Valid ProductAccessRuleRequest> rules) {
    }

    public record ProductAccessRuleRequest(
            @NotNull ProductAccessScopeType scopeType,
            @Min(1) Long scopeId
    ) {
    }

    public record ProductAccessRuleView(
            Long id,
            Long productId,
            String scopeType,
            Long scopeId,
            String effect,
            java.time.Instant createdAt
    ) {
    }
}
