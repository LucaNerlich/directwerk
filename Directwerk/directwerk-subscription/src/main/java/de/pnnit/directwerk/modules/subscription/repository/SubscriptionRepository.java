package de.pnnit.directwerk.modules.subscription.repository;

import de.pnnit.directwerk.modules.subscription.entity.Subscription;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionStatus;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface SubscriptionRepository extends JpaRepository<Subscription, Long> {

    @EntityGraph(attributePaths = "product")
    List<Subscription> findByTenantIdAndUserId(Long tenantId, Long userId);

    Optional<Subscription> findByIdAndTenantId(Long id, Long tenantId);

    Optional<Subscription> findByTenantIdAndUserIdAndProductId(Long tenantId, Long userId, Long productId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            SELECT s FROM Subscription s
            WHERE s.tenant.id = :tenantId
              AND s.user.id = :userId
              AND s.product.id = :productId
            """)
    Optional<Subscription> findByTenantIdAndUserIdAndProductIdForUpdate(
            @Param("tenantId") Long tenantId,
            @Param("userId") Long userId,
            @Param("productId") Long productId
    );

    Optional<Subscription> findByTenantIdAndExternalSubscriptionId(Long tenantId, String externalSubscriptionId);

    /**
     * Pessimistic variant used by Stripe webhook handling: the row lock is held for the rest of
     * the surrounding transaction so a concurrent {@code customer.subscription.deleted} cannot
     * commit between the canceled-row check and the write that would resurrect it.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            SELECT s FROM Subscription s
            WHERE s.tenant.id = :tenantId
              AND s.externalSubscriptionId = :externalSubscriptionId
            """)
    Optional<Subscription> findByTenantIdAndExternalSubscriptionIdForUpdate(
            @Param("tenantId") Long tenantId,
            @Param("externalSubscriptionId") String externalSubscriptionId
    );

    Optional<Subscription> findByTenantIdAndExternalPaymentId(Long tenantId, String externalPaymentId);

    @Query("""
            SELECT s FROM Subscription s
            JOIN FETCH s.product
            JOIN FETCH s.user
            WHERE s.tenant.id = :tenantId
            ORDER BY s.user.id ASC, s.id ASC
            """)
    List<Subscription> findDetailedByTenantId(@Param("tenantId") Long tenantId);

    @Query("""
            SELECT s FROM Subscription s
            JOIN FETCH s.product
            JOIN FETCH s.user
            WHERE s.id = :id AND s.tenant.id = :tenantId
            """)
    Optional<Subscription> findDetailedByIdAndTenantId(
            @Param("id") Long id,
            @Param("tenantId") Long tenantId
    );

    @Query("""
            SELECT s FROM Subscription s
            JOIN FETCH s.product p
            WHERE s.tenant.id = :tenantId
              AND s.user.id = :userId
              AND s.status = :status
              AND p.active = TRUE
            ORDER BY p.sortOrder ASC, p.id ASC
            """)
    List<Subscription> findActiveWithProducts(
            @Param("tenantId") Long tenantId,
            @Param("userId") Long userId,
            @Param("status") SubscriptionStatus status
    );
}
