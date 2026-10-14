package de.pnnit.directwerk.modules.core.service;

import de.pnnit.directwerk.modules.core.audit.PlatformAuditActions;
import de.pnnit.directwerk.modules.core.audit.PlatformAuditService;
import de.pnnit.directwerk.modules.core.entity.InvitationType;
import de.pnnit.directwerk.modules.core.entity.PlatformAdmin;
import de.pnnit.directwerk.modules.core.entity.User;
import de.pnnit.directwerk.modules.core.entity.UserStatus;
import de.pnnit.directwerk.modules.core.repository.PlatformAdminRepository;
import de.pnnit.directwerk.modules.core.repository.TenantMembershipRepository;
import de.pnnit.directwerk.modules.core.repository.UserRepository;
import de.pnnit.directwerk.modules.core.util.EmailNormalizer;
import de.pnnit.directwerk.modules.email.TransactionalEmailNotifier;
import de.pnnit.directwerk.security.SecurityUtils;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
public class PlatformAdminManagementService {

    /** Upper bound on the admin list page size, mirroring the controller's {@code @Max}. */
    private static final int MAX_ADMIN_PAGE_SIZE = 100;

    private final PlatformAdminRepository platformAdminRepository;
    private final UserRepository userRepository;
    private final TenantMembershipRepository tenantMembershipRepository;
    private final InvitationTokenService invitationTokenService;
    private final TransactionalEmailNotifier transactionalEmailNotifier;
    private final UserProvisioningService userProvisioningService;
    private final PlatformAuditService platformAuditService;

    /**
     * Lists one page of platform administrators and their user details.
     *
     * <p>Ordered by row id so that pages stay stable between requests, and the last-login lookup is
     * batched across the page instead of issued once per admin (#438).
     *
     * @param page zero-based page index
     * @param size requested page size, clamped to {@link #MAX_ADMIN_PAGE_SIZE}
     * @return the page of administrators together with its paging metadata
     */
    @Transactional(readOnly = true)
    public AdminPage listAdmins(int page, int size) {
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), MAX_ADMIN_PAGE_SIZE);
        Page<PlatformAdmin> result = platformAdminRepository.findAll(
                PageRequest.of(safePage, safeSize, Sort.by("id").ascending()));
        Map<Long, Instant> lastLogins = lastLoginsByUserId(result.getContent());
        List<PlatformAdminView> content = result.getContent().stream()
                .map(admin -> view(admin.getUser(), lastLogins.get(admin.getUser().getId())))
                .toList();
        return new AdminPage(content, result.getTotalElements(), safePage, safeSize);
    }

    private Map<Long, Instant> lastLoginsByUserId(List<PlatformAdmin> admins) {
        List<Long> userIds = admins.stream().map(admin -> admin.getUser().getId()).toList();
        if (userIds.isEmpty()) {
            return Map.of();
        }
        Map<Long, Instant> lastLogins = new HashMap<>();
        for (TenantMembershipRepository.LastLogin lastLogin
                : tenantMembershipRepository.findMaxLastLoginAtByUserIds(userIds)) {
            if (lastLogin.getLastLoginAt() != null) {
                lastLogins.put(lastLogin.getUserId(), lastLogin.getLastLoginAt());
            }
        }
        return lastLogins;
    }

    /**
     * Invites a user to become a platform administrator.
     *
     * @param email the user's email address
     * @param name  the user's display name
     * @return the administrator details, resulting status, and invitation token
     * @throws IllegalArgumentException if the email address is blank
     */
    @Transactional
    public PlatformAdminInvitation inviteAdmin(String email, String name) {
        if (!StringUtils.hasText(email)) {
            throw new IllegalArgumentException("Email is required");
        }
        String normalizedEmail = EmailNormalizer.normalize(email);
        User user = userProvisioningService.findOrCreatePendingUser(normalizedEmail, name);

        if (platformAdminRepository.findByUserId(user.getId()).isPresent()) {
            return new PlatformAdminInvitation(viewWithLastLogin(user), user.getStatus().name(), null);
        }

        // Never promote solely on an email match. The PlatformAdmin row is created only when the
        // invitee accepts the PLATFORM_ADMIN token, so an already-ACTIVE user (e.g. a tenant
        // subscriber) cannot be granted platform admin without their consent.
        if (user.getStatus() != UserStatus.ACTIVE) {
            user.setStatus(UserStatus.PENDING_VERIFICATION);
            if (StringUtils.hasText(name)) {
                user.setName(name.trim());
            }
            userRepository.save(user);
        }

        String inviteToken = invitationTokenService.issue(user, null, InvitationType.PLATFORM_ADMIN);
        transactionalEmailNotifier.sendPlatformAdminInvitation(
                user.getEmail(),
                user.getName(),
                inviteToken,
                InvitationTokenService.tokenLifetime()
        );
        return new PlatformAdminInvitation(viewWithLastLogin(user), user.getStatus().name(), inviteToken);
    }

    /** One page of platform administrators plus the metadata the client pages with. */
    public record AdminPage(
            List<PlatformAdminView> content,
            long totalElements,
            int page,
            int size
    ) {
    }

    private static PlatformAdminView view(User user, Instant lastLoginAt) {
        return new PlatformAdminView(user.getId(), user.getEmail(), user.getName(), lastLoginAt);
    }

    private PlatformAdminView viewWithLastLogin(User user) {
        return view(user, tenantMembershipRepository.findMaxLastLoginAtByUserId(user.getId()).orElse(null));
    }

    /**
     * Revokes a platform administrator's access.
     *
     * @param userId the identifier of the user whose platform admin access is revoked
     * @return the view of the admin that was revoked
     * @throws PlatformAdminNotFoundException           if the user is not a platform admin
     * @throws CannotRevokeSelfException                if the caller is revoking their own access
     * @throws CannotRevokeLastPlatformAdminException   if this would leave zero platform admins
     */
    @Transactional
    public PlatformAdminView revokeAdmin(Long userId) {
        List<PlatformAdmin> lockedAdmins = platformAdminRepository.findAllForUpdate();
        PlatformAdmin admin = lockedAdmins.stream()
                .filter(candidate -> candidate.getUser().getId().equals(userId))
                .findFirst()
                .orElseThrow(() -> new PlatformAdminNotFoundException(userId));

        Long callerUserId = SecurityUtils.currentUserId();
        if (callerUserId != null && callerUserId.equals(userId)) {
            throw new CannotRevokeSelfException(userId);
        }
        if (lockedAdmins.size() <= 1) {
            throw new CannotRevokeLastPlatformAdminException(userId);
        }

        PlatformAdminView revokedView = viewWithLastLogin(admin.getUser());
        platformAdminRepository.delete(admin);
        platformAuditService.record(
                PlatformAuditActions.PLATFORM_ADMIN_REVOKED,
                null,
                Map.of("userId", userId, "email", admin.getUser().getEmail())
        );
        return revokedView;
    }

    public record PlatformAdminView(
            Long userId,
            String email,
            String name,
            java.time.Instant lastLoginAt
    ) {
    }

    public record PlatformAdminInvitation(PlatformAdminView admin, String status, String inviteToken) {
    }
}
