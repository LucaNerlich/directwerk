package de.pnnit.directwerk.modules.core.repository;

import de.pnnit.directwerk.modules.core.entity.MembershipStatus;
import de.pnnit.directwerk.modules.core.entity.TenantMembership;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface TenantMembershipRepository extends JpaRepository<TenantMembership, Long> {

    Optional<TenantMembership> findByUserIdAndTenantId(Long userId, Long tenantId);

    List<TenantMembership> findByTenantId(Long tenantId);

    Optional<TenantMembership> findByTenantIdAndUserId(Long tenantId, Long userId);

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
}
