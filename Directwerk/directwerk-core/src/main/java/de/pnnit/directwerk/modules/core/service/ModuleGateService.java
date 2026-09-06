package de.pnnit.directwerk.modules.core.service;

import de.pnnit.directwerk.config.DirectwerkCacheNames;
import de.pnnit.directwerk.modules.core.repository.TenantModuleActivationRepository;
import de.pnnit.directwerk.multitenancy.TenantContext;
import java.util.Collection;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ModuleGateService {

    private final TenantModuleActivationRepository tenantModuleActivationRepository;
    /**
     * Proxied self-reference — the single enforcement Seam of this Module.
     *
     * <p>Spring AOP proxies do not intercept self-invocation, so the cached
     * {@link #enabledModuleKeys} read below must go through the proxy. Never call
     * {@code this.enabledModuleKeys(..)} — it silently bypasses the tenant-module-keys
     * cache and turns every gate check into a repository query. Both the declarative
     * ({@code RequiresModuleAspect}) and every programmatic {@code requireModule} caller
     * converge on {@link #requireModules}, which performs exactly one cached read.
     */
    private final ObjectProvider<ModuleGateService> self;

    /**
     * Transactional so repository access runs on a transaction-bound session
     * (tenant Hibernate filter applies) — see {@code TenantHibernateFilterEnabler}.
     */
    @Transactional(readOnly = true)
    public void requireModule(String moduleKey) {
        requireModules(List.of(moduleKey));
    }

    /**
     * Batch enforcement behind the same Seam: one cached activation read covers every key.
     * Missing tenant context fails closed as disabled (deliberate, status-stable: callers
     * and {@code GlobalExceptionHandler} keep mapping this to {@code FEATURE_NOT_ENABLED},
     * never to {@code TENANT_REQUIRED}).
     */
    @Transactional(readOnly = true)
    public void requireModules(Collection<String> moduleKeys) {
        Long tenantId = TenantContext.getTenantId();
        if (tenantId == null) {
            throw new ModuleNotEnabledException(
                    moduleKeys.stream().findFirst().orElse("<unknown>"));
        }
        Set<String> enabled = self.getObject().enabledModuleKeys(tenantId);
        for (String moduleKey : moduleKeys) {
            if (!enabled.contains(moduleKey)) {
                throw new ModuleNotEnabledException(moduleKey);
            }
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
