package de.pnnit.directwerk.modules.core.service;

import de.pnnit.directwerk.config.DirectwerkCacheNames;
import de.pnnit.directwerk.modules.core.repository.TenantModuleActivationRepository;
import de.pnnit.directwerk.multitenancy.TenantContext;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ModuleGateService {

    private final TenantModuleActivationRepository tenantModuleActivationRepository;

    /**
     * Transactional so repository access runs on a transaction-bound session
     * (tenant Hibernate filter applies) — see {@code TenantHibernateFilterEnabler}.
     */
    @Transactional(readOnly = true)
    public void requireModule(String moduleKey) {
        Long tenantId = TenantContext.getTenantId();
        if (tenantId == null) {
            throw new ModuleNotEnabledException(moduleKey);
        }
        boolean active = tenantModuleActivationRepository.findByTenantIdAndModuleKey(tenantId, moduleKey)
                .map(activation -> activation.isActive())
                .orElse(false);
        if (!active) {
            throw new ModuleNotEnabledException(moduleKey);
        }
    }

    @Cacheable(cacheNames = DirectwerkCacheNames.TENANT_MODULE_KEYS, key = "#tenantId")
    @Transactional(readOnly = true)
    public Set<String> enabledModuleKeys(Long tenantId) {
        return tenantModuleActivationRepository.findByTenantIdAndActiveTrue(tenantId).stream()
                .map(activation -> activation.getModuleKey())
                .collect(Collectors.toUnmodifiableSet());
    }

    /** Worker-safe module check without {@link TenantContext}. */
    @Transactional(readOnly = true)
    public boolean isModuleActive(Long tenantId, String moduleKey) {
        return tenantModuleActivationRepository.findByTenantIdAndModuleKey(tenantId, moduleKey)
                .map(activation -> activation.isActive())
                .orElse(false);
    }
}
