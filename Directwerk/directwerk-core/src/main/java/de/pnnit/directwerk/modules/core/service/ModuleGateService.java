package de.pnnit.directwerk.modules.core.service;

import de.pnnit.directwerk.config.DirectwerkCacheNames;
import de.pnnit.directwerk.modules.core.repository.TenantModuleActivationRepository;
import de.pnnit.directwerk.multitenancy.TenantContext;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ModuleGateService {

    private final TenantModuleActivationRepository tenantModuleActivationRepository;

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
    public Set<String> enabledModuleKeys(Long tenantId) {
        return tenantModuleActivationRepository.findByTenantIdAndActiveTrue(tenantId).stream()
                .map(activation -> activation.getModuleKey())
                .collect(Collectors.toUnmodifiableSet());
    }
}
