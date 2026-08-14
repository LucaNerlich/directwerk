package de.pnnit.directwerk.modules.core.audit;

import de.pnnit.directwerk.modules.core.entity.PlatformAuditEvent;
import de.pnnit.directwerk.modules.core.repository.PlatformAuditEventRepository;
import de.pnnit.directwerk.security.DirectwerkUserPrincipal;
import de.pnnit.directwerk.security.SecurityUtils;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PlatformAuditService {

    private final PlatformAuditEventRepository platformAuditEventRepository;

    /**
     * Records a platform audit event with the specified action, tenant, and details.
     *
     * <p>Associates the event with the current user when an authenticated principal is available.
     * A {@code null} details map is stored as an empty map.</p>
     *
     * <p>Runs in an independent transaction to ensure audit persistence is isolated from the
     * caller's transaction. Audit failures do not mark the parent transaction for rollback.</p>
     *
     * @param action  the action to record
     * @param tenantId the tenant associated with the event
     * @param details the event details, or {@code null} for no details
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(String action, Long tenantId, Map<String, Object> details) {
        PlatformAuditEvent event = new PlatformAuditEvent();
        event.setAction(action);
        event.setTenantId(tenantId);
        event.setDetails(details == null ? Map.of() : Map.copyOf(details));
        DirectwerkUserPrincipal principal = SecurityUtils.currentPrincipal();
        if (principal != null) {
            event.setActorUserId(principal.userId());
        }
        platformAuditEventRepository.save(event);
    }
}
