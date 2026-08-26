package de.pnnit.directwerk.modules.core.service;

import de.pnnit.directwerk.modules.core.exception.ConflictException;
import de.pnnit.directwerk.modules.core.exception.ConflictCodes;
import de.pnnit.directwerk.modules.core.audit.PlatformAuditActions;
import de.pnnit.directwerk.modules.core.audit.PlatformAuditService;
import de.pnnit.directwerk.modules.core.entity.Role;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import java.util.List;
import de.pnnit.directwerk.modules.core.entity.TenantBranding;
import de.pnnit.directwerk.modules.core.entity.TenantDomain;
import de.pnnit.directwerk.modules.core.entity.TenantStatus;
import de.pnnit.directwerk.modules.core.repository.TenantBrandingRepository;
import de.pnnit.directwerk.modules.core.repository.TenantDomainRepository;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.content.TenantRssSnapshotStaleEvent;
import de.pnnit.directwerk.modules.core.util.SlugNormalizer;
import de.pnnit.directwerk.modules.core.util.TenantHostname;
import java.time.Instant;
import java.util.Map;
import java.util.Objects;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
public class TenantManagementService {

    private static final int MAX_TENANT_LIST_SIZE = 1000;

    private final TenantRepository tenantRepository;
    private final TenantDomainRepository tenantDomainRepository;
    private final TenantBrandingRepository tenantBrandingRepository;
    private final ModuleManagementService moduleManagementService;
    private final TenantInvitationService tenantInvitationService;
    private final DirectwerkCacheEviction cacheEviction;
    private final PlatformAuditService platformAuditService;
    private final ApplicationEventPublisher eventPublisher;

    /**
     * Lists tenants for the platform admin surface, bounded so an unbounded table can never
     * produce an unbounded response.
     */
    @Transactional(readOnly = true)
    public List<Tenant> listTenants() {
        return tenantRepository.findAll(PageRequest.of(0, MAX_TENANT_LIST_SIZE, Sort.by("id").ascending())).getContent();
    }

    /**
     * Retrieves a tenant by its identifier.
     *
     * @param tenantId the identifier of the tenant
     * @return the tenant's detail view
     */
    @Transactional(readOnly = true)
    public TenantDetailView getTenant(Long tenantId) {
        return toView(tenantRepository.requireById(tenantId));
    }

    /**
     * Creates a tenant without an administrator invitation.
     *
     * @param name           the tenant name
     * @param slug           the tenant slug
     * @param primaryDomain the optional primary domain
     * @param modulePreset  the optional module preset
     * @return the created tenant details
     */
    @Transactional
    public TenantDetailView createTenant(String name, String slug, String primaryDomain, String modulePreset) {
        return createTenant(name, slug, primaryDomain, modulePreset, null, null).tenant();
    }

    /**
     * Creates an active tenant with optional domain, module preset, and administrator invitation.
     *
     * @param name           the tenant name
     * @param slug           the tenant slug
     * @param primaryDomain the optional primary domain
     * @param modulePreset  the optional module preset to apply
     * @param adminEmail    the optional tenant administrator email address
     * @param adminName     the optional tenant administrator name
     * @return the created tenant and optional administrator invitation
     * @throws IllegalArgumentException if the tenant name is missing
     * @throws IllegalStateException    if the tenant slug already exists
     */
    @Transactional
    public TenantCreationResult createTenant(
            String name,
            String slug,
            String primaryDomain,
            String modulePreset,
            String adminEmail,
            String adminName
    ) {
        if (!StringUtils.hasText(name)) {
            throw new IllegalArgumentException("Tenant name is required");
        }
        String normalizedSlug = SlugNormalizer.normalize(slug);
        if (tenantRepository.findBySlug(normalizedSlug).isPresent()) {
            throw new ConflictException(ConflictCodes.TENANT_SLUG_EXISTS, "Tenant slug already exists: " + normalizedSlug);
        }

        Tenant tenant = new Tenant();
        tenant.setName(name.trim());
        tenant.setSlug(normalizedSlug);
        tenant.setStatus(TenantStatus.ACTIVE);
        tenant = tenantRepository.save(tenant);

        String normalizedHost = null;
        if (StringUtils.hasText(primaryDomain)) {
            normalizedHost = TenantHostname.normalize(primaryDomain);
            if (tenantDomainRepository.findByHostIgnoreCase(normalizedHost).isPresent()) {
                throw new DomainAlreadyExistsException(normalizedHost);
            }
            TenantDomain domain = new TenantDomain();
            domain.setTenant(tenant);
            domain.setHost(normalizedHost);
            domain.setPrimary(true);
            domain.setVerified(true);
            domain.setVerifiedAt(Instant.now());
            tenantDomainRepository.save(domain);
            cacheEviction.evictHostAfterCommit(normalizedHost);
        }

        TenantBranding branding = new TenantBranding();
        branding.setTenant(tenant);
        branding.setSiteTitle(tenant.getName());
        tenantBrandingRepository.save(branding);

        if (StringUtils.hasText(modulePreset)) {
            moduleManagementService.applyPreset(tenant.getId(), modulePreset);
        }

        TenantInvitationService.InvitationResult adminInvitation = null;
        if (StringUtils.hasText(adminEmail)) {
            adminInvitation = tenantInvitationService.invite(
                    tenant.getId(),
                    adminEmail,
                    adminName,
                    Role.TENANT_ADMIN.name()
            );
        }

        platformAuditService.record(
                PlatformAuditActions.TENANT_CREATED,
                tenant.getId(),
                Map.of(
                        "slug", tenant.getSlug(),
                        "name", tenant.getName(),
                        "primaryDomain", normalizedHost == null ? "" : normalizedHost
                )
        );

        return new TenantCreationResult(toView(tenant), adminInvitation);
    }

    /**
     * Suspends a tenant.
     *
     * @param tenantId the identifier of the tenant to suspend
     * @return the updated tenant details
     */
    @Transactional
    public TenantDetailView suspendTenant(Long tenantId) {
        Tenant tenant = tenantRepository.requireById(tenantId);
        tenant.setStatus(TenantStatus.SUSPENDED);
        Tenant saved = tenantRepository.save(tenant);
        cacheEviction.evictTenantPublicCachesAfterCommit(tenantId);
        platformAuditService.record(PlatformAuditActions.TENANT_SUSPENDED, tenantId, Map.of());
        return toView(saved);
    }

    /**
     * Sets a tenant's status to active.
     *
     * @param tenantId the identifier of the tenant to reactivate
     * @return the updated tenant details
     */
    @Transactional
    public TenantDetailView reactivateTenant(Long tenantId) {
        Tenant tenant = tenantRepository.requireById(tenantId);
        tenant.setStatus(TenantStatus.ACTIVE);
        Tenant saved = tenantRepository.save(tenant);
        cacheEviction.evictTenantPublicCachesAfterCommit(tenantId);
        platformAuditService.record(PlatformAuditActions.TENANT_REACTIVATED, tenantId, Map.of());
        return toView(saved);
    }

    /**
     * Updates the specified tenant's name and slug when provided.
     *
     * @param tenantId the identifier of the tenant to update
     * @param name     the new name, or blank/null to keep the current name
     * @param slug     the new slug, or blank/null to keep the current slug
     * @return the updated tenant details
     * @throws IllegalStateException if the new slug is already used by another tenant
     */
    @Transactional
    public TenantDetailView updateTenant(Long tenantId, String name, String slug) {
        Tenant tenant = tenantRepository.requireById(tenantId);
        String previousName = tenant.getName();
        String previousSlug = tenant.getSlug();

        if (StringUtils.hasText(name)) {
            tenant.setName(name.trim());
        }

        if (StringUtils.hasText(slug)) {
            String normalizedSlug = SlugNormalizer.normalize(slug);
            if (!normalizedSlug.equals(tenant.getSlug())
                    && tenantRepository.findBySlug(normalizedSlug).isPresent()) {
                throw new ConflictException(ConflictCodes.TENANT_SLUG_EXISTS, "Tenant slug already exists: " + normalizedSlug);
            }
            tenant.setSlug(normalizedSlug);
        }

        Tenant saved = tenantRepository.save(tenant);
        boolean slugChanged = !Objects.equals(previousSlug, saved.getSlug());
        if (!Objects.equals(previousName, saved.getName()) || slugChanged) {
            eventPublisher.publishEvent(new TenantRssSnapshotStaleEvent(
                    tenantId,
                    slugChanged ? previousSlug : null
            ));
        }
        cacheEviction.evictTenantPublicCachesAfterCommit(tenantId);
        platformAuditService.record(
                PlatformAuditActions.TENANT_UPDATED,
                tenantId,
                Map.of("name", saved.getName(), "slug", saved.getSlug())
        );
        return toView(saved);
    }

    /**
     * Retrieves a tenant by its identifier.
     *
     * @param tenantId the tenant identifier
     * @return the matching tenant
     */

    private TenantDetailView toView(Tenant tenant) {
        return new TenantDetailView(
                tenant.getId(),
                tenant.getSlug(),
                tenant.getName(),
                tenant.getStatus().name()
        );
    }

    public record TenantDetailView(Long id, String slug, String name, String status) {
    }

    public record TenantCreationResult(
            TenantDetailView tenant,
            TenantInvitationService.InvitationResult adminInvitation
    ) {
    }
}
