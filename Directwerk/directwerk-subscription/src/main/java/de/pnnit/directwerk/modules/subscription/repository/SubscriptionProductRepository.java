package de.pnnit.directwerk.modules.subscription.repository;

import de.pnnit.directwerk.modules.subscription.entity.SubscriptionProduct;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SubscriptionProductRepository extends JpaRepository<SubscriptionProduct, Long> {

    List<SubscriptionProduct> findByTenantIdOrderBySortOrderAscIdAsc(Long tenantId);

    List<SubscriptionProduct> findByTenantIdAndActiveTrueOrderBySortOrderAscIdAsc(Long tenantId);

    Optional<SubscriptionProduct> findByIdAndTenantId(Long id, Long tenantId);

    Optional<SubscriptionProduct> findByTenantIdAndSlug(Long tenantId, String slug);

    boolean existsByTenantIdAndSlug(Long tenantId, String slug);
}
