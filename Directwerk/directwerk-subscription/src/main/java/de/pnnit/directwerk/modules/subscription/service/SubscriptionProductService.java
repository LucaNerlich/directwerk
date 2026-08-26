package de.pnnit.directwerk.modules.subscription.service;

import de.pnnit.directwerk.modules.core.exception.ConflictException;
import de.pnnit.directwerk.modules.core.exception.ConflictCodes;
import de.pnnit.directwerk.config.DirectwerkCacheNames;
import de.pnnit.directwerk.modules.content.TenantEntitlementsChangedEvent;
import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.core.service.DirectwerkCacheEviction;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.core.util.SlugNormalizer;
import de.pnnit.directwerk.modules.subscription.SubscriptionModule;
import de.pnnit.directwerk.modules.subscription.entity.BillingInterval;
import de.pnnit.directwerk.modules.subscription.entity.OfferingType;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionProduct;
import de.pnnit.directwerk.modules.subscription.exception.SubscriptionProductNotFoundException;
import de.pnnit.directwerk.modules.subscription.repository.SubscriptionProductRepository;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class SubscriptionProductService {

    private static final int MAX_TITLE_LENGTH = 255;

    private final SubscriptionProductRepository subscriptionProductRepository;
    private final TenantRepository tenantRepository;
    private final DirectwerkCacheEviction cacheEviction;
    private final ApplicationEventPublisher eventPublisher;

    @Transactional(readOnly = true)
    @Cacheable(
            cacheNames = DirectwerkCacheNames.PUBLIC_PRODUCTS,
            key = "#tenantId",
            condition = "#activeOnly"
    )
    public List<SubscriptionProduct> listProducts(Long tenantId, boolean activeOnly) {
        if (activeOnly) {
            return subscriptionProductRepository.findByTenantIdAndActiveTrueOrderBySortOrderAscIdAsc(tenantId);
        }
        return subscriptionProductRepository.findByTenantIdOrderBySortOrderAscIdAsc(tenantId);
    }

    @Transactional(readOnly = true)
    public SubscriptionProduct requireProduct(Long tenantId, Long productId) {
        return subscriptionProductRepository.findByIdAndTenantId(productId, tenantId)
                .orElseThrow(() -> new SubscriptionProductNotFoundException(productId));
    }

    @Transactional(readOnly = true)
    public SubscriptionProduct requireProductBySlug(Long tenantId, String slug) {
        return subscriptionProductRepository.findByTenantIdAndSlug(tenantId, SlugNormalizer.normalize(slug))
                .orElseThrow(() -> new SubscriptionProductNotFoundException(slug));
    }

    @Transactional
    @RequiresModule(SubscriptionModule.MODULE_KEY)
    public SubscriptionProduct createProduct(
            Long tenantId,
            String rawSlug,
            String title,
            Integer sortOrder,
            OfferingType offeringType,
            String description,
            Integer priceCents,
            String currency,
            BillingInterval billingInterval
    ) {
        String slug = SlugNormalizer.normalize(rawSlug);
        if (subscriptionProductRepository.existsByTenantIdAndSlug(tenantId, slug)) {
            throw new ConflictException(ConflictCodes.PRODUCT_SLUG_EXISTS, "Product slug already exists: " + slug);
        }

        SubscriptionProduct product = new SubscriptionProduct();
        product.setTenant(tenantRepository.getReferenceById(tenantId));
        product.setSlug(slug);
        product.setTitle(normalizeTitle(title));
        product.setOfferingType(offeringType != null ? offeringType : OfferingType.LEVEL);
        product.setSortOrder(sortOrder != null ? sortOrder : 0);
        product.setActive(true);
        product.setDescription(normalizeDescription(description));
        product.setPriceCents(normalizePriceCents(priceCents));
        product.setCurrency(normalizeCurrency(currency));
        product.setBillingInterval(billingInterval != null ? billingInterval : BillingInterval.MONTH);
        SubscriptionProduct saved = subscriptionProductRepository.save(product);
        cacheEviction.evictPublicProductsAfterCommit(tenantId);
        eventPublisher.publishEvent(new TenantEntitlementsChangedEvent(tenantId));
        return saved;
    }

    @Transactional
    @RequiresModule(SubscriptionModule.MODULE_KEY)
    public SubscriptionProduct updateProduct(
            Long tenantId,
            Long productId,
            String title,
            Integer sortOrder,
            Boolean active,
            String description,
            Integer priceCents,
            String currency,
            BillingInterval billingInterval
    ) {
        SubscriptionProduct product = requireProduct(tenantId, productId);

        if (title != null) {
            product.setTitle(normalizeTitle(title));
        }
        if (sortOrder != null) {
            product.setSortOrder(sortOrder);
        }
        if (active != null) {
            product.setActive(active);
        }
        if (description != null) {
            product.setDescription(normalizeDescription(description));
        }
        boolean priceChanged = false;
        if (priceCents != null) {
            Integer normalized = normalizePriceCents(priceCents);
            priceChanged = !java.util.Objects.equals(product.getPriceCents(), normalized);
            product.setPriceCents(normalized);
        }
        if (currency != null) {
            String normalized = normalizeCurrency(currency);
            priceChanged = priceChanged || !normalized.equals(product.getCurrency());
            product.setCurrency(normalized);
        }
        if (billingInterval != null) {
            priceChanged = priceChanged || billingInterval != product.getBillingInterval();
            product.setBillingInterval(billingInterval);
        }
        if (priceChanged) {
            product.setStripePriceId(null);
        }
        SubscriptionProduct saved = subscriptionProductRepository.save(product);
        cacheEviction.evictPublicProductsAfterCommit(tenantId);
        eventPublisher.publishEvent(new TenantEntitlementsChangedEvent(tenantId));
        return saved;
    }

    @Transactional
    @RequiresModule(SubscriptionModule.MODULE_KEY)
    public SubscriptionProduct deactivateProduct(Long tenantId, Long productId) {
        return updateProduct(tenantId, productId, null, null, false, null, null, null, null);
    }

    @Transactional
    @RequiresModule(SubscriptionModule.MODULE_KEY)
    public SubscriptionProduct assignStripeIds(
            Long tenantId,
            Long productId,
            String stripeProductId,
            String stripePriceId
    ) {
        SubscriptionProduct product = requireProduct(tenantId, productId);
        product.setStripeProductId(stripeProductId);
        product.setStripePriceId(stripePriceId);
        SubscriptionProduct saved = subscriptionProductRepository.save(product);
        cacheEviction.evictPublicProductsAfterCommit(tenantId);
        return saved;
    }

    private String normalizeDescription(String description) {
        if (description == null || description.isBlank()) {
            return null;
        }
        String normalized = description.trim();
        if (normalized.length() > 2000) {
            throw new IllegalArgumentException("Product description must be at most 2000 characters");
        }
        return normalized;
    }

    private Integer normalizePriceCents(Integer priceCents) {
        if (priceCents == null) {
            return null;
        }
        if (priceCents < 0) {
            throw new IllegalArgumentException("Product price must be at least 0");
        }
        return priceCents;
    }

    private String normalizeCurrency(String currency) {
        String normalized = currency == null || currency.isBlank()
                ? "EUR"
                : currency.trim().toUpperCase(java.util.Locale.ROOT);
        if (!normalized.matches("^[A-Z]{3}$")) {
            throw new IllegalArgumentException("Currency must be a 3-letter ISO code");
        }
        return normalized;
    }

    private String normalizeTitle(String title) {
        if (title == null || title.isBlank()) {
            throw new IllegalArgumentException("Product title is required");
        }
        String normalized = title.trim();
        if (normalized.length() > MAX_TITLE_LENGTH) {
            throw new IllegalArgumentException("Product title must be at most 255 characters");
        }
        return normalized;
    }
}
