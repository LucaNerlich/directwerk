package de.pnnit.directwerk.modules.core.service;

import de.pnnit.directwerk.config.DirectwerkCacheNames;
import de.pnnit.directwerk.modules.content.TenantRssSnapshotStaleEvent;
import de.pnnit.directwerk.modules.core.audit.PlatformAuditActions;
import de.pnnit.directwerk.modules.core.audit.PlatformAuditService;
import de.pnnit.directwerk.modules.core.entity.FeatureModule;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.entity.TenantModuleActivation;
import de.pnnit.directwerk.modules.core.repository.FeatureModuleRepository;
import de.pnnit.directwerk.modules.core.repository.TenantModuleActivationRepository;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
public class ModuleManagementService {

    private final FeatureModuleRepository featureModuleRepository;
    private final TenantModuleActivationRepository tenantModuleActivationRepository;
    private final TenantLookupService tenantLookupService;
    private final DirectwerkCacheEviction cacheEviction;
    private final PlatformAuditService platformAuditService;
    private final ApplicationEventPublisher eventPublisher;

    /**
     * Lists all platform-active modules in module-key order.
     *
     * @return the platform-active modules
     */
    @Transactional(readOnly = true)
    @Cacheable(cacheNames = DirectwerkCacheNames.PLATFORM_MODULES)
    public List<ModuleView> listAllModules() {
        return featureModuleRepository.findByPlatformActiveTrueOrderByModuleKeyAsc().stream()
                .map(this::toView)
                .toList();
    }

    @Transactional(readOnly = true)
    @Cacheable(cacheNames = DirectwerkCacheNames.TENANT_MODULE_VIEWS, key = "#tenantId")
    public TenantModulesView getTenantModules(Long tenantId) {
        requireTenant(tenantId);
        List<String> enabledModules = tenantModuleActivationRepository.findByTenantIdAndActiveTrue(tenantId).stream()
                .map(TenantModuleActivation::getModuleKey)
                .sorted()
                .toList();
        return new TenantModulesView(enabledModules);
    }

    /**
     * Activates a platform module for a tenant after validating its dependencies.
     *
     * @param tenantId  the tenant to update
     * @param moduleKey the key of the module to activate
     * @return the tenant's enabled modules after activation
     */
    @Transactional
    public TenantModulesView activateModule(Long tenantId, String moduleKey) {
        Tenant tenant = requireTenant(tenantId);
        FeatureModule module = requirePlatformModule(moduleKey);
        validateDependencies(tenantId, module);

        TenantModuleActivation activation = tenantModuleActivationRepository
                .findByTenantIdAndModuleKey(tenantId, module.getModuleKey())
                .orElseGet(() -> {
                    TenantModuleActivation created = new TenantModuleActivation();
                    created.setTenant(tenant);
                    created.setModuleKey(module.getModuleKey());
                    created.setSource("MANUAL");
                    return created;
                });
        boolean newlyActivated = activation.getId() == null || !activation.isActive();
        activation.setActive(true);
        tenantModuleActivationRepository.save(activation);
        cacheEviction.evictTenantPublicCachesAfterCommit(tenantId);
        if (newlyActivated && "PODCAST_RSS".equals(module.getModuleKey())) {
            eventPublisher.publishEvent(new TenantRssSnapshotStaleEvent(tenantId));
        }
        platformAuditService.record(
                PlatformAuditActions.MODULE_ACTIVATED,
                tenantId,
                Map.of("moduleKey", module.getModuleKey())
        );
        return getTenantModules(tenantId);
    }

    /**
     * Deactivates a tenant module and any modules that depend on it.
     *
     * @param tenantId  the tenant whose module configuration is updated
     * @param moduleKey the key of the module to deactivate
     * @return the tenant's updated module configuration
     */
    @Transactional
    public TenantModulesView deactivateModule(Long tenantId, String moduleKey) {
        requireTenant(tenantId);
        FeatureModule module = requirePlatformModule(moduleKey);
        if (module.isCore()) {
            throw new CannotDeactivateCoreModuleException(module.getModuleKey());
        }

        Set<String> moduleKeysToDeactivate = findDependentModules(module.getModuleKey());
        for (String key : moduleKeysToDeactivate) {
            tenantModuleActivationRepository.findByTenantIdAndModuleKey(tenantId, key)
                    .ifPresent(activation -> {
                        activation.setActive(false);
                        tenantModuleActivationRepository.save(activation);
                    });
        }
        cacheEviction.evictTenantPublicCachesAfterCommit(tenantId);
        if (moduleKeysToDeactivate.contains("PODCAST_RSS")) {
            eventPublisher.publishEvent(new TenantRssSnapshotStaleEvent(tenantId));
        }
        platformAuditService.record(
                PlatformAuditActions.MODULE_DEACTIVATED,
                tenantId,
                Map.of("moduleKey", module.getModuleKey())
        );
        return getTenantModules(tenantId);
    }

    @Transactional
    public TenantModulesView applyPreset(Long tenantId, String presetKey) {
        ModulePreset preset = ModulePreset.fromKey(presetKey)
                .orElseThrow(() -> new IllegalArgumentException("Unknown module preset: " + presetKey));

        List<FeatureModule> modules = featureModuleRepository.findByPlatformActiveTrueOrderByModuleKeyAsc();
        List<String> orderedKeys = modules.stream()
                .map(FeatureModule::getModuleKey)
                .filter(key -> preset.moduleKeys().contains(key))
                .sorted(Comparator.comparingInt(key -> dependencyWeight(key, modules)))
                .toList();

        for (String moduleKey : orderedKeys) {
            activateModule(tenantId, moduleKey);
        }
        return getTenantModules(tenantId);
    }

    private int dependencyWeight(String moduleKey, List<FeatureModule> modules) {
        return modules.stream()
                .filter(module -> module.getModuleKey().equals(moduleKey))
                .findFirst()
                .map(module -> module.getDependsOn().size())
                .orElse(0);
    }

    private void validateDependencies(Long tenantId, FeatureModule module) {
        for (String dependency : module.getDependsOn()) {
            boolean active = tenantModuleActivationRepository.findByTenantIdAndModuleKey(tenantId, dependency)
                    .map(TenantModuleActivation::isActive)
                    .orElse(false);
            if (!active) {
                throw new ModuleDependencyMissingException(module.getModuleKey(), dependency);
            }
        }
    }

    private Set<String> findDependentModules(String moduleKey) {
        List<FeatureModule> allModules = featureModuleRepository.findAll();
        Set<String> dependents = new LinkedHashSet<>();
        ArrayDeque<String> queue = new ArrayDeque<>();
        queue.add(moduleKey);
        while (!queue.isEmpty()) {
            String current = queue.removeFirst();
            if (!dependents.add(current)) {
                continue;
            }
            for (FeatureModule module : allModules) {
                if (module.getDependsOn().contains(current)) {
                    queue.add(module.getModuleKey());
                }
            }
        }
        return dependents;
    }

    private Tenant requireTenant(Long tenantId) {
        return tenantLookupService.requireTenant(tenantId);
    }

    private FeatureModule requirePlatformModule(String moduleKey) {
        if (!StringUtils.hasText(moduleKey)) {
            throw new IllegalArgumentException("Module key is required");
        }
        FeatureModule module = featureModuleRepository.findByModuleKey(moduleKey.trim().toUpperCase())
                .orElseThrow(() -> new IllegalArgumentException("Unknown module: " + moduleKey));
        if (!module.isPlatformActive()) {
            throw new IllegalArgumentException("Module is not platform active: " + moduleKey);
        }
        return module;
    }

    private ModuleView toView(FeatureModule module) {
        return new ModuleView(
                module.getModuleKey(),
                module.getName(),
                module.getDescription(),
                List.copyOf(module.getDependsOn()),
                module.isCore()
        );
    }

    public record ModuleView(
            String moduleKey,
            String name,
            String description,
            List<String> dependsOn,
            boolean core
    ) {
    }

    public record TenantModulesView(List<String> enabledModules) {
    }
}
