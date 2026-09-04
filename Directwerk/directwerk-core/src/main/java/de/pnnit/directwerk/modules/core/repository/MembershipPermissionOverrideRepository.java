package de.pnnit.directwerk.modules.core.repository;

import de.pnnit.directwerk.modules.core.entity.MembershipPermissionOverride;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface MembershipPermissionOverrideRepository
        extends JpaRepository<MembershipPermissionOverride, Long> {

    @Query("""
            select override from MembershipPermissionOverride override
            join fetch override.membership membership
            where membership.tenant.id = :tenantId
              and membership.user.id = :userId
            """)
    List<MembershipPermissionOverride> findByTenantIdAndUserId(
            @Param("tenantId") Long tenantId,
            @Param("userId") Long userId
    );

    void deleteByTenantIdAndMembershipId(Long tenantId, Long membershipId);
}
