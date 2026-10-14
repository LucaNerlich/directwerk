package de.pnnit.directwerk.job;

import de.pnnit.directwerk.modules.core.entity.User;
import de.pnnit.directwerk.modules.core.repository.UserRepository;
import de.pnnit.directwerk.modules.core.service.MembershipPermissionService;
import de.pnnit.directwerk.security.DirectwerkUserPrincipal;
import java.util.Optional;
import org.springframework.stereotype.Component;

/**
 * Resolves the editor a queued bulk import executes as (issue #303).
 *
 * <p>Bulk imports run in a queue worker thread with no security context, yet they write tenant
 * content through the same RBAC-gated services the controllers use. Now that those gates fail
 * closed, the job has to bind the requesting editor's identity explicitly instead of relying on an
 * unauthenticated context being read as a trusted system path.
 *
 * <p>Binding the requester also restores ownership attribution: imported drafts are stamped with
 * {@code SecurityUtils.currentUserId()}, which previously resolved to {@code null} for every
 * imported episode and article — leaving imported content unowned and uneditable by an
 * {@code OWN_ONLY}-restricted editor.
 */
@Component
public class ImportRequesterResolver {

    private final UserRepository userRepository;
    private final MembershipPermissionService membershipPermissionService;

    public ImportRequesterResolver(
            UserRepository userRepository,
            MembershipPermissionService membershipPermissionService
    ) {
        this.userRepository = userRepository;
        this.membershipPermissionService = membershipPermissionService;
    }

    /**
     * @param tenantId          the tenant the job runs in
     * @param requestedByUserId the requester recorded when the job was enqueued, or {@code null}
     *                          for payloads enqueued before that field existed
     * @param notifyEmail       the requester's address, used to resolve those older payloads
     * @return the requester's principal
     * @throws IllegalStateException when the requester cannot be resolved to a member of the tenant,
     *                              so the run fails up front rather than importing item by item and
     *                              being denied at the gate
     */
    public DirectwerkUserPrincipal requireRequester(
            Long tenantId,
            Long requestedByUserId,
            String notifyEmail
    ) {
        Long userId = requestedByUserId != null ? requestedByUserId : lookupUserId(notifyEmail);
        Optional<DirectwerkUserPrincipal> principal = userId == null
                ? Optional.empty()
                : membershipPermissionService.principalForMember(tenantId, userId);
        return principal.orElseThrow(() -> new IllegalStateException(
                "Bulk import requester is not a member of tenant " + tenantId
                        + " (userId=" + userId + "); refusing to import without an identity"));
    }

    private Long lookupUserId(String email) {
        if (email == null || email.isBlank()) {
            return null;
        }
        return userRepository.findByEmailIgnoreCase(email).map(User::getId).orElse(null);
    }
}
