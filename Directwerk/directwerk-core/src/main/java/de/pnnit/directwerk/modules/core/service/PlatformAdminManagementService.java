package de.pnnit.directwerk.modules.core.service;

import de.pnnit.directwerk.modules.core.audit.PlatformAuditActions;
import de.pnnit.directwerk.modules.core.audit.PlatformAuditService;
import de.pnnit.directwerk.modules.core.entity.InvitationType;
import de.pnnit.directwerk.modules.core.entity.PlatformAdmin;
import de.pnnit.directwerk.modules.core.entity.User;
import de.pnnit.directwerk.modules.core.entity.UserStatus;
import de.pnnit.directwerk.modules.core.repository.PlatformAdminRepository;
import de.pnnit.directwerk.modules.core.repository.UserRepository;
import de.pnnit.directwerk.modules.core.util.EmailNormalizer;
import de.pnnit.directwerk.modules.email.TransactionalEmailNotifier;
import de.pnnit.directwerk.security.SecurityUtils;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
public class PlatformAdminManagementService {

    private final PlatformAdminRepository platformAdminRepository;
    private final UserRepository userRepository;
    private final InvitationTokenService invitationTokenService;
    private final TransactionalEmailNotifier transactionalEmailNotifier;
    private final UserProvisioningService userProvisioningService;
    private final PlatformAuditService platformAuditService;

    /**
     * Lists the platform administrators and their user details.
     *
     * @return the platform administrator views
     */
    @Transactional(readOnly = true)
    public List<PlatformAdminView> listAdmins() {
        return platformAdminRepository.findAll().stream()
                .map(admin -> new PlatformAdminView(
                        admin.getUser().getId(),
                        admin.getUser().getEmail(),
                        admin.getUser().getName()
                ))
                .toList();
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

        PlatformAdmin admin = platformAdminRepository.findByUserId(user.getId()).orElseGet(() -> {
            PlatformAdmin created = new PlatformAdmin();
            created.setUser(user);
            return platformAdminRepository.save(created);
        });

        // Already-active users receive admin access immediately — no re-verification / invite flow.
        if (user.getStatus() == UserStatus.ACTIVE) {
            PlatformAdminView view = new PlatformAdminView(
                    admin.getUser().getId(),
                    admin.getUser().getEmail(),
                    admin.getUser().getName()
            );
            return new PlatformAdminInvitation(view, user.getStatus().name(), null);
        }

        user.setStatus(UserStatus.PENDING_VERIFICATION);
        if (StringUtils.hasText(name)) {
            user.setName(name.trim());
        }
        userRepository.save(user);

        String inviteToken = invitationTokenService.issue(user, null, InvitationType.PLATFORM_ADMIN);
        transactionalEmailNotifier.sendPlatformAdminInvitation(
                user.getEmail(),
                user.getName(),
                inviteToken,
                InvitationTokenService.tokenLifetime()
        );
        PlatformAdminView view = new PlatformAdminView(
                admin.getUser().getId(),
                admin.getUser().getEmail(),
                admin.getUser().getName()
        );
        return new PlatformAdminInvitation(view, user.getStatus().name(), inviteToken);
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
        PlatformAdmin admin = platformAdminRepository.findByUserId(userId)
                .orElseThrow(() -> new PlatformAdminNotFoundException(userId));

        Long callerUserId = SecurityUtils.currentUserId();
        if (callerUserId != null && callerUserId.equals(userId)) {
            throw new CannotRevokeSelfException(userId);
        }
        if (platformAdminRepository.count() <= 1) {
            throw new CannotRevokeLastPlatformAdminException(userId);
        }

        PlatformAdminView view = new PlatformAdminView(
                admin.getUser().getId(),
                admin.getUser().getEmail(),
                admin.getUser().getName()
        );
        platformAdminRepository.delete(admin);
        platformAuditService.record(
                PlatformAuditActions.PLATFORM_ADMIN_REVOKED,
                null,
                Map.of("userId", userId, "email", admin.getUser().getEmail())
        );
        return view;
    }

    public record PlatformAdminView(Long userId, String email, String name) {
    }

    public record PlatformAdminInvitation(PlatformAdminView admin, String status, String inviteToken) {
    }
}
