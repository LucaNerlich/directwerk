package de.pnnit.directwerk.modules.core.repository;

import de.pnnit.directwerk.modules.core.entity.TenantModuleActivation;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface TenantModuleActivationRepository extends JpaRepository<TenantModuleActivation, Long> {

    List<TenantModuleActivation> findByTenantIdAndActiveTrue(Long tenantId);

    List<TenantModuleActivation> findByTenantIdOrderByModuleKeyAsc(Long tenantId);

    Optional<TenantModuleActivation> findByTenantIdAndModuleKey(Long tenantId, String moduleKey);

    @Query("""
            select activation.moduleKey, count(distinct activation.tenant.id)
            from TenantModuleActivation activation
            where activation.active = true
            group by activation.moduleKey
            order by activation.moduleKey asc
            """)
    List<Object[]> countActiveTenantsGroupedByModule();

    @Query("""
            select distinct activation.tenant.id
            from TenantModuleActivation activation
            where activation.active = true
              and activation.moduleKey = :moduleKey
            """)
    List<Long> findTenantIdsWithActiveModule(@Param("moduleKey") String moduleKey);
}
