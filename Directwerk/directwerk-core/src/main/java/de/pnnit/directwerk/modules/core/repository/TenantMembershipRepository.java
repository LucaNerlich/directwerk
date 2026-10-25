package de.pnnit.directwerk.modules.core.repository;

import de.pnnit.directwerk.modules.core.entity.MembershipStatus;
import de.pnnit.directwerk.modules.core.entity.TenantMembership;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface TenantMembershipRepository extends JpaRepository<TenantMembership, Long> {

    Optional<TenantMembership> findByUserIdAndTenantId(Long userId, Long tenantId);

    /**
     * #561: the tenant directory read model dereferences {@code membership.user.email/name} per
     * row, and there is no {@code default_batch_fetch_size} in this repo, so listing N members
     * issued 1 + N selects. The graph makes it one.
     */
    @EntityGraph(attributePaths = "user")
    List<TenantMembership> findByTenantId(Long tenantId);

    /**
     * Bounded tenant directory page (#561 remaining): optional case-insensitive email/name search.
     * {@code queryBlank} avoids binding an empty LIKE pattern when no filter is requested.
     */
    @EntityGraph(attributePaths = "user")
    @Query(
            value = """
                    select membership from TenantMembership membership
                    where membership.tenantId = :tenantId
                      and (
                        :queryBlank = true
                        or lower(membership.user.email) like lower(concat('%', :query, '%'))
                        or lower(coalesce(membership.user.name, '')) like lower(concat('%', :query, '%'))
                      )
                    """,
            countQuery = """
                    select count(membership) from TenantMembership membership
                    where membership.tenantId = :tenantId
                      and (
                        :queryBlank = true
                        or lower(membership.user.email) like lower(concat('%', :query, '%'))
                        or lower(coalesce(membership.user.name, '')) like lower(concat('%', :query, '%'))
                      )
                    """
    )
    Page<TenantMembership> searchByTenantId(
            @Param("tenantId") Long tenantId,
            @Param("query") String query,
            @Param("queryBlank") boolean queryBlank,
            Pageable pageable
    );

    Optional<TenantMembership> findByTenantIdAndUserId(Long tenantId, Long userId);

    /** Batch variant (#345) — see MembershipPermissionOverrideRepository.findByTenantIdAndUserIdIn. */
    @Query("""
            select membership from TenantMembership membership
            join fetch membership.user
            where membership.tenantId = :tenantId
              and membership.user.id in :userIds
            """)
    List<TenantMembership> findByTenantIdAndUserIdIn(
            @Param("tenantId") Long tenantId,
            @Param("userIds") java.util.Collection<Long> userIds
    );

    @Query("""
            select membership from TenantMembership membership
            join fetch membership.tenant tenant
            where membership.user.id = :userId
              and membership.status = :status
              and tenant.status = de.pnnit.directwerk.modules.core.entity.TenantStatus.ACTIVE
            """)
    List<TenantMembership> findActiveMembershipsByUserId(
            @Param("userId") Long userId,
            @Param("status") MembershipStatus status
    );

    @Query("""
            select membership from TenantMembership membership
            join fetch membership.user user
            where membership.tenant.id = :tenantId
              and membership.status = :status
              and membership.emailNotificationsEnabled = true
              and user.status = de.pnnit.directwerk.modules.core.entity.UserStatus.ACTIVE
            """)
    List<TenantMembership> findNotificationOptedInMembers(
            @Param("tenantId") Long tenantId,
            @Param("status") MembershipStatus status
    );

    @Query("""
            select membership.user.id from TenantMembership membership
            where membership.tenant.id = :tenantId
              and membership.status = :status
            """)
    List<Long> findActiveUserIdsByTenantId(
            @Param("tenantId") Long tenantId,
            @Param("status") MembershipStatus status
    );

    @Query("""
            select max(membership.lastLoginAt) from TenantMembership membership
            where membership.user.id = :userId
            """)
    Optional<Instant> findMaxLastLoginAtByUserId(@Param("userId") Long userId);

    /**
     * Batched variant of {@link #findMaxLastLoginAtByUserId} (#438). The platform admin list needs
     * the last login of a whole page of admins; a lookup per admin made that N+1.
     */
    @Query("""
            select membership.user.id as userId, max(membership.lastLoginAt) as lastLoginAt
            from TenantMembership membership
            where membership.user.id in :userIds
            group by membership.user.id
            """)
    List<LastLogin> findMaxLastLoginAtByUserIds(@Param("userIds") Collection<Long> userIds);

    /** Projection for {@link #findMaxLastLoginAtByUserIds}. */
    interface LastLogin {

        Long getUserId();

        Instant getLastLoginAt();
    }
}
