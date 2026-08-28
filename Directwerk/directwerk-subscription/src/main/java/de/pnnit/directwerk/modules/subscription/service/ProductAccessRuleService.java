package de.pnnit.directwerk.modules.subscription.service;

import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.content.TenantEntitlementsChangedEvent;
import de.pnnit.directwerk.modules.subscription.SubscriptionModule;
import de.pnnit.directwerk.modules.subscription.entity.OfferingType;
import de.pnnit.directwerk.modules.subscription.entity.ProductAccessEffect;
import de.pnnit.directwerk.modules.subscription.entity.ProductAccessRule;
import de.pnnit.directwerk.modules.subscription.entity.ProductAccessScopeType;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionProduct;
import de.pnnit.directwerk.modules.subscription.repository.ProductAccessRuleRepository;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ProductAccessRuleService {

    private final ProductAccessRuleRepository productAccessRuleRepository;
    private final SubscriptionProductService subscriptionProductService;
    private final ProductAccessRuleScopeValidator productAccessRuleScopeValidator;
    private final ApplicationEventPublisher eventPublisher;

    @Transactional(readOnly = true)
    public List<ProductAccessRule> listRules(Long tenantId, Long productId) {
        subscriptionProductService.requireProduct(tenantId, productId);
        return productAccessRuleRepository.findByTenantIdAndProductIdOrderByIdAsc(tenantId, productId);
    }

    @Transactional
    @RequiresModule(SubscriptionModule.MODULE_KEY)
    public List<ProductAccessRule> replaceRules(Long tenantId, Long productId, List<RuleInput> inputs) {
        SubscriptionProduct product = subscriptionProductService.requireProduct(tenantId, productId);
        if (product.getOfferingType() != OfferingType.PACKAGE) {
            throw new IllegalArgumentException("Access rules can only be assigned to PACKAGE products");
        }

        List<RuleInput> safeInputs = inputs == null ? List.of() : List.copyOf(inputs);
        for (RuleInput input : safeInputs) {
            productAccessRuleScopeValidator.validateScope(tenantId, input.scopeType(), input.scopeId());
        }
        productAccessRuleRepository.deleteByTenantIdAndProductId(tenantId, productId);
        List<ProductAccessRule> rules = safeInputs.stream()
                .map(input -> toRule(product, input))
                .toList();
        productAccessRuleRepository.saveAll(rules);
        eventPublisher.publishEvent(new TenantEntitlementsChangedEvent(tenantId));
        return productAccessRuleRepository.findByTenantIdAndProductIdOrderByIdAsc(tenantId, productId);
    }

    private ProductAccessRule toRule(SubscriptionProduct product, RuleInput input) {
        if (input == null || input.scopeType() == null) {
            throw new IllegalArgumentException("scopeType is required");
        }
        validateScopeId(input.scopeType(), input.scopeId());

        ProductAccessRule rule = new ProductAccessRule();
        rule.setTenant(product.getTenant());
        rule.setProduct(product);
        rule.setScopeType(input.scopeType());
        rule.setScopeId(input.scopeId());
        rule.setEffect(ProductAccessEffect.GRANT);
        return rule;
    }

    private static void validateScopeId(ProductAccessScopeType scopeType, Long scopeId) {
        switch (scopeType) {
            case ALL_PODCASTS, FEED_BUILDER -> {
                if (scopeId != null) {
                    throw new IllegalArgumentException(scopeType + " rules must not set scopeId");
                }
            }
            case PODCAST_SERIES, FORMAT, CATEGORY, DIGITAL_ASSET -> {
                if (scopeId == null || scopeId <= 0) {
                    throw new IllegalArgumentException(scopeType + " rules require a positive scopeId");
                }
            }
            default -> throw new IllegalStateException("Unexpected scope type: " + scopeType);
        }
    }

    public record RuleInput(ProductAccessScopeType scopeType, Long scopeId) {
    }
}
