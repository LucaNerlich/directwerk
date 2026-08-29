package de.pnnit.directwerk.modules.core.service;

import de.pnnit.directwerk.modules.core.entity.TenantStatus;
import de.pnnit.directwerk.modules.core.repository.TenantModuleActivationRepository;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.core.service.PlatformAuditQueryService.PlatformAuditView;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PlatformOverviewService {

    private final TenantRepository tenantRepository;
    private final TenantModuleActivationRepository tenantModuleActivationRepository;
    private final PlatformAuditQueryService platformAuditQueryService;

    public PlatformOverviewView getOverview(int recentAuditLimit) {
        long activeTenants = tenantRepository.countByStatus(TenantStatus.ACTIVE);
        long suspendedTenants = tenantRepository.countByStatus(TenantStatus.SUSPENDED);

        List<ModuleAdoptionView> moduleAdoption = tenantModuleActivationRepository
                .countActiveTenantsGroupedByModule()
                .stream()
                .map(row -> new ModuleAdoptionView((String) row[0], ((Number) row[1]).longValue()))
                .toList();

        List<PlatformAuditView> recentAudit = platformAuditQueryService.listRecent(recentAuditLimit);

        return new PlatformOverviewView(
                new TenantCountSummary(activeTenants, suspendedTenants),
                moduleAdoption,
                recentAudit
        );
    }

    public record PlatformOverviewView(
            TenantCountSummary tenantCounts,
            List<ModuleAdoptionView> moduleAdoption,
            List<PlatformAuditView> recentAudit
    ) {
    }

    public record TenantCountSummary(long active, long suspended) {
    }

    public record ModuleAdoptionView(String moduleKey, long tenantCount) {
    }
}
