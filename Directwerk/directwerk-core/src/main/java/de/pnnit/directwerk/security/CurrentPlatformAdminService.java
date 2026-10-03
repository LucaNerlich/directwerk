package de.pnnit.directwerk.security;

import de.pnnit.directwerk.modules.core.entity.PlatformAdmin;
import de.pnnit.directwerk.modules.core.entity.UserStatus;
import de.pnnit.directwerk.modules.core.repository.PlatformAdminRepository;
import de.pnnit.directwerk.multitenancy.PlatformAdminAccessDeniedException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Re-validates platform-admin grant against the DB for authenticated platform routes.
 *
 * <p>Complements JWT {@code ROLE_PLATFORM_ADMIN} claims (trusted until access-token expiry)
 * by requiring a live {@link PlatformAdmin} row and an {@link UserStatus#ACTIVE} user.
 */
@Service
@RequiredArgsConstructor
public class CurrentPlatformAdminService {

    private final PlatformAdminRepository platformAdminRepository;

    /**
     * Requires the authenticated principal to still be an active platform administrator.
     *
     * @throws PlatformAdminAccessDeniedException if the admin row is missing or the user is not ACTIVE
     * @throws de.pnnit.directwerk.multitenancy.TenantMismatchException if no authenticated principal is present
     */
    @Transactional(readOnly = true)
    public void requireActivePlatformAdmin() {
        DirectwerkUserPrincipal principal = SecurityUtils.requirePrincipal();
        PlatformAdmin admin = platformAdminRepository.findByUserId(principal.userId())
                .orElseThrow(PlatformAdminAccessDeniedException::new);
        if (admin.getUser().getStatus() != UserStatus.ACTIVE) {
            throw new PlatformAdminAccessDeniedException();
        }
    }
}
