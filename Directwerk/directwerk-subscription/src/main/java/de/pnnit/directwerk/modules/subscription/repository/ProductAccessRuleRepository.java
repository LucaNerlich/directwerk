package de.pnnit.directwerk.modules.subscription.repository;

import de.pnnit.directwerk.modules.subscription.entity.ProductAccessRule;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface ProductAccessRuleRepository extends JpaRepository<ProductAccessRule, Long> {

    @EntityGraph(attributePaths = "product")
    @Query("""
            SELECT rule FROM ProductAccessRule rule
            JOIN rule.product product
            WHERE rule.tenant.id = :tenantId
              AND product.id = :productId
            ORDER BY rule.id ASC
            """)
    List<ProductAccessRule> findByTenantIdAndProductIdOrderByIdAsc(
            @Param("tenantId") Long tenantId,
            @Param("productId") Long productId
    );

    @EntityGraph(attributePaths = "product")
    @Query("""
            SELECT rule FROM ProductAccessRule rule
            JOIN rule.product product
            WHERE rule.tenant.id = :tenantId
              AND product.id IN :productIds
            ORDER BY product.id ASC, rule.id ASC
            """)
    List<ProductAccessRule> findByTenantIdAndProductIdInOrderByProductIdAscIdAsc(
            @Param("tenantId") Long tenantId,
            @Param("productIds") Collection<Long> productIds
    );

    @Modifying
    @Query("""
            DELETE FROM ProductAccessRule rule
            WHERE rule.tenant.id = :tenantId
              AND rule.product.id = :productId
            """)
    void deleteByTenantIdAndProductId(
            @Param("tenantId") Long tenantId,
            @Param("productId") Long productId
    );
}
