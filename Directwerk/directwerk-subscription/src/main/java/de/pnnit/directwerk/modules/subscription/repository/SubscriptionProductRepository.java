package de.pnnit.directwerk.modules.subscription.repository;

import de.pnnit.directwerk.modules.subscription.entity.SubscriptionProduct;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SubscriptionProductRepository extends JpaRepository<SubscriptionProduct, Long> {

    List<SubscriptionProduct> findByTenantIdOrderBySortOrderAscIdAsc(Long tenantId);

    /** Paged variant (#310) — bounds the response instead of materialising every row. */
        List<SubscriptionProduct> findByTenantIdOrderBySortOrderAscIdAsc(Long tenantId, Pageable pageable);

    List<SubscriptionProduct> findByTenantIdAndActiveTrueOrderBySortOrderAscIdAsc(Long tenantId);

    /** Paged variant (#310) — bounds the response instead of materialising every row. */
        List<SubscriptionProduct> findByTenantIdAndActiveTrueOrderBySortOrderAscIdAsc(Long tenantId, Pageable pageable);

    Optional<SubscriptionProduct> findByIdAndTenantId(Long id, Long tenantId);

    /** Indexed lookup for webhook price→product resolution (issue #366). */
    Optional<SubscriptionProduct> findFirstByTenantIdAndStripePriceIdOrderByIdAsc(Long tenantId, String stripePriceId);

    Optional<SubscriptionProduct> findByTenantIdAndSlug(Long tenantId, String slug);

    boolean existsByTenantIdAndSlug(Long tenantId, String slug);
}
