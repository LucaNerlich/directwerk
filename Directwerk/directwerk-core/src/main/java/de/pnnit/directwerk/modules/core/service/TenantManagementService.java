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
import de.pnnit.directwerk.modules.core.util.EmailNormalizer;
import de.pnnit.directwerk.modules.core.util.SlugNormalizer;
import de.pnnit.directwerk.modules.core.util.TenantHostname;
import java.time.Instant;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
public class TenantManagementService {

    /** Upper bound on the tenant list page size, mirroring the controller's {@code @Max}. */
    private static final int MAX_TENANT_PAGE_SIZE = 100;

    private final TenantRepository tenantRepository;
    private final TenantDomainRepository tenantDomainRepository;
    private final TenantBrandingRepository tenantBrandingRepository;
    private final ModuleManagementService moduleManagementService;
    private final TenantInvitationService tenantInvitationService;
    private final DirectwerkCacheEviction cacheEviction;
    private final PlatformAuditService platformAuditService;
    private final ApplicationEventPublisher eventPublisher;

    /**
     * Lists one page of tenants for the platform admin surface.
     *
     * <p>Previously this returned the first {@code 1000} tenants with no way to reach the rest, so
     * past that size the platform UI silently truncated the estate (#438).
     *
     * @param page zero-based page index
     * @param size requested page size, clamped to {@link #MAX_TENANT_PAGE_SIZE}
     * @return the page of tenants together with its paging metadata
     */
    @Transactional(readOnly = true)
    public TenantPage listTenants(int page, int size) {
        return listTenants(page, size, null);
    }

    /**
     * Lists one page of tenants, optionally filtered by an estate-wide search term.
     *
     * @param page zero-based page index
     * @param size page size, clamped to the maximum
     * @param query optional case-insensitive name/slug/domain search; blank means no filter
     * @return the page of tenants
     */
    @Transactional(readOnly = true)
    public TenantPage listTenants(int page, int size, String query) {
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), MAX_TENANT_PAGE_SIZE);
        Pageable pageable = PageRequest.of(safePage, safeSize, Sort.by("id").ascending());
        String trimmed = query == null ? "" : query.trim();
        Page<Tenant> result = trimmed.isEmpty()
                ? tenantRepository.findAll(pageable)
                : tenantRepository.search(trimmed, pageable);
        Map<Long, List<TenantDomain>> domainsByTenant = domainsByTenant(result.getContent());
        return new TenantPage(
                result.getContent().stream()
                        .map(tenant -> toListItemView(
                                tenant, domainsByTenant.getOrDefault(tenant.getId(), List.of())))
                        .toList(),
                result.getTotalElements(),
                safePage,
                safeSize);
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
        try {
            tenant = tenantRepository.save(tenant);
            // Explicit flush so the unique constraint is evaluated inside this method (#356).
            tenantRepository.flush();
        } catch (DataIntegrityViolationException ex) {
            throw asSlugConflict(ex, normalizedSlug);
        }

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

        activateCoreModules(tenant.getId());
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
        return updateTenant(tenantId, name, slug, null, false);
    }

    /**
     * Updates name/slug and optionally the podcast contact email.
     *
     * @param contactEmail        new contact email when {@code updateContactEmail} is true
     * @param updateContactEmail  whether to apply {@code contactEmail} (blank clears)
     */
    @Transactional
    public TenantDetailView updateTenant(
            Long tenantId,
            String name,
            String slug,
            String contactEmail,
            boolean updateContactEmail
    ) {
        Tenant tenant = tenantRepository.requireById(tenantId);
        String previousName = tenant.getName();
        String previousSlug = tenant.getSlug();
        String previousContactEmail = tenant.getContactEmail();

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

        if (updateContactEmail) {
            tenant.setContactEmail(EmailNormalizer.normalizeOptional(contactEmail));
        }

        Tenant saved;
        try {
            saved = tenantRepository.save(tenant);
            // Explicit flush so a concurrent slug race is caught here, not at commit (#356).
            tenantRepository.flush();
        } catch (DataIntegrityViolationException ex) {
            throw asSlugConflict(ex, tenant.getSlug());
        }
        boolean slugChanged = !Objects.equals(previousSlug, saved.getSlug());
        boolean contactChanged = !Objects.equals(previousContactEmail, saved.getContactEmail());
        if (!Objects.equals(previousName, saved.getName()) || slugChanged || contactChanged) {
            eventPublisher.publishEvent(new TenantRssSnapshotStaleEvent(
                    tenantId,
                    slugChanged ? previousSlug : null
            ));
        }
        cacheEviction.evictTenantPublicCachesAfterCommit(tenantId);
        platformAuditService.record(
                PlatformAuditActions.TENANT_UPDATED,
                tenantId,
                Map.of(
                        "name", saved.getName(),
                        "slug", saved.getSlug(),
                        "contactEmail", saved.getContactEmail() == null ? "" : saved.getContactEmail()
                )
        );
        return toView(saved);
    }

    /**
     * Sets or clears the tenant podcast contact email used in generated RSS owner tags.
     *
     * @param tenantId     the tenant
     * @param contactEmail new address, or blank/null to clear
     * @return updated tenant details
     */
    @Transactional
    public TenantDetailView updateContactEmail(Long tenantId, String contactEmail) {
        return updateTenant(tenantId, null, null, contactEmail, true);
    }

    /**
     * Updates the specified tenant's per-asset-type upload size overrides.
     * {@code null} components reset that type to the platform default.
     *
     * @param tenantId the identifier of the tenant to update
     * @param limits   the overrides to persist (validated on construction)
     * @return the updated overrides
     */
    @Transactional
    public TenantUploadLimits updateUploadLimits(Long tenantId, TenantUploadLimits limits) {
        Tenant tenant = tenantRepository.requireById(tenantId);
        tenant.setMaxAudioBytes(limits.maxAudioBytes());
        tenant.setMaxImageBytes(limits.maxImageBytes());
        tenant.setMaxVideoBytes(limits.maxVideoBytes());
        tenant.setMaxDocumentBytes(limits.maxDocumentBytes());
        tenantRepository.save(tenant);
        cacheEviction.evictTenantPublicCachesAfterCommit(tenantId);
        platformAuditService.record(
                PlatformAuditActions.TENANT_UPDATED,
                tenantId,
                Map.of(
                        "maxAudioBytes", String.valueOf(limits.maxAudioBytes()),
                        "maxImageBytes", String.valueOf(limits.maxImageBytes()),
                        "maxVideoBytes", String.valueOf(limits.maxVideoBytes()),
                        "maxDocumentBytes", String.valueOf(limits.maxDocumentBytes())
                )
        );
        return limits;
    }

    private void activateCoreModules(Long tenantId) {
        moduleManagementService.listAllModules().stream()
                .filter(ModuleManagementService.ModuleView::core)
                .forEach(module -> moduleManagementService.activateModule(tenantId, module.moduleKey()));
    }

    private TenantDetailView toView(Tenant tenant) {
        List<TenantDomain> domains = tenantDomainRepository.findByTenantId(tenant.getId());
        String primaryDomain = domains.stream()
                .filter(TenantDomain::isPrimary)
                .map(TenantDomain::getHost)
                .findFirst()
                .orElse(null);

        return new TenantDetailView(
                tenant.getId(),
                tenant.getSlug(),
                tenant.getName(),
                tenant.getStatus().name(),
                tenant.getCreatedAt(),
                primaryDomain,
                domains.stream()
                        .map(domain -> new TenantDomainView(domain.getHost(), domain.isPrimary(), domain.isVerified()))
                        .toList(),
                new TenantUploadLimits(
                        tenant.getMaxAudioBytes(),
                        tenant.getMaxImageBytes(),
                        tenant.getMaxVideoBytes(),
                        tenant.getMaxDocumentBytes()
                ),
                tenant.getContactEmail()
        );
    }

    private Map<Long, List<TenantDomain>> domainsByTenant(List<Tenant> tenants) {
        List<Long> tenantIds = tenants.stream().map(Tenant::getId).toList();
        if (tenantIds.isEmpty()) {
            return Map.of();
        }
        return tenantDomainRepository.findByTenantIdIn(tenantIds).stream()
                .collect(Collectors.groupingBy(domain -> domain.getTenant().getId()));
    }

    private TenantListItemView toListItemView(Tenant tenant, List<TenantDomain> domains) {
        String primaryDomain = domains.stream()
                .filter(TenantDomain::isPrimary)
                .map(TenantDomain::getHost)
                .findFirst()
                .orElse(null);

        return new TenantListItemView(
                tenant.getId(),
                tenant.getSlug(),
                tenant.getName(),
                tenant.getStatus().name(),
                tenant.getCreatedAt(),
                primaryDomain
        );
    }

    /** One page of tenants plus the metadata the client pages with. */
    public record TenantPage(
            List<TenantListItemView> content,
            long totalElements,
            int page,
            int size
    ) {
    }

    public record TenantDetailView(
            Long id,
            String slug,
            String name,
            String status,
            Instant createdAt,
            String primaryDomain,
            List<TenantDomainView> domains,
            TenantUploadLimits uploadLimits,
            String contactEmail
    ) {
    }

    public record TenantListItemView(
            Long id,
            String slug,
            String name,
            String status,
            Instant createdAt,
            String primaryDomain
    ) {
    }

    public record TenantDomainView(String host, boolean primary, boolean verified) {
    }

    public record TenantCreationResult(
            TenantDetailView tenant,
            TenantInvitationService.InvitationResult adminInvitation
    ) {
    }

    /**
     * Translates a {@code tenants.slug} unique-constraint violation into the intended 409.
     * The pre-checks in {@link #createTenant}/{@link #updateTenant} cannot close the race
     * between two concurrent writers; the loser used to surface as a 500 (issue #356).
     */
    private static ConflictException asSlugConflict(DataIntegrityViolationException ex, String slug) {
        String causeMessage = ex.getMostSpecificCause().getMessage();
        if (causeMessage != null && causeMessage.contains("uq_tenants_slug")) {
            return new ConflictException(ConflictCodes.TENANT_SLUG_EXISTS, "Tenant slug already exists: " + slug);
        }
        throw ex;
    }
}
