package de.pnnit.directwerk.modules.core.service;

import de.pnnit.directwerk.modules.core.entity.TenantMembership;
import de.pnnit.directwerk.modules.core.repository.TenantMembershipRepository;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
public class TenantUserQueryService {

    /** Upper bound on the directory page size, mirroring the controller's {@code @Max}. */
    private static final int MAX_USER_PAGE_SIZE = 100;

    private final TenantMembershipRepository tenantMembershipRepository;
    private final TenantRepository tenantRepository;

    /**
     * Lists every membership for a tenant. Prefer {@link #listTenantUsers(Long, int, int, String)}
     * for directory UIs — unbounded lists grow linearly with tenant size (#561).
     */
    @Transactional(readOnly = true)
    public List<TenantUserView> listTenantUsers(Long tenantId) {
        tenantRepository.requireById(tenantId);
        return tenantMembershipRepository.findByTenantId(tenantId).stream()
                .map(this::toView)
                .toList();
    }

    /**
     * One page of tenant members, optionally filtered by email/name (#561).
     *
     * @param page  zero-based page index
     * @param size  requested page size, clamped to {@link #MAX_USER_PAGE_SIZE}
     * @param query optional case-insensitive email/name search; blank means no filter
     */
    @Transactional(readOnly = true)
    public TenantUserPage listTenantUsers(Long tenantId, int page, int size, String query) {
        tenantRepository.requireById(tenantId);
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), MAX_USER_PAGE_SIZE);
        Pageable pageable = PageRequest.of(safePage, safeSize, Sort.by("user.id").ascending());
        String trimmed = query == null ? "" : query.trim();
        boolean queryBlank = !StringUtils.hasText(trimmed);
        Page<TenantMembership> result = tenantMembershipRepository.searchByTenantId(
                tenantId,
                trimmed,
                queryBlank,
                pageable
        );
        return new TenantUserPage(
                result.getContent().stream().map(this::toView).toList(),
                result.getTotalElements(),
                safePage,
                safeSize
        );
    }

    private TenantUserView toView(TenantMembership membership) {
        return new TenantUserView(
                membership.getUser().getId(),
                membership.getUser().getEmail(),
                membership.getUser().getName(),
                membership.getRoles().stream().map(Enum::name).sorted().toList(),
                membership.getStatus().name(),
                membership.getInvitedAt(),
                membership.getLastLoginAt()
        );
    }

    /** One page of tenant users plus the metadata the client pages with. */
    public record TenantUserPage(
            List<TenantUserView> content,
            long totalElements,
            int page,
            int size
    ) {
    }

    public record TenantUserView(
            Long userId,
            String email,
            String name,
            List<String> roles,
            String status,
            java.time.Instant invitedAt,
            java.time.Instant lastLoginAt
    ) {
    }
}
