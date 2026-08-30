package de.pnnit.directwerk.modules.core.audit;

import de.pnnit.directwerk.modules.core.transaction.TransactionAfterCommit;
import de.pnnit.directwerk.security.DirectwerkUserPrincipal;
import de.pnnit.directwerk.security.SecurityUtils;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class PlatformAuditService {

    private final PlatformAuditEventWriter platformAuditEventWriter;

    /**
     * Records a platform audit event with the specified action, tenant, and details.
     *
     * <p>Associates the event with the current user when an authenticated principal is available.
     * A {@code null} details map is stored as an empty map.</p>
     *
     * <p>Persistence is deferred until the caller's transaction commits so tenant-scoped rows
     * referenced by {@code tenant_id} satisfy the audit FK. The write itself runs in an
     * independent transaction so audit failures do not roll back committed business work.</p>
     *
     * @param action  the action to record
     * @param tenantId the tenant associated with the event
     * @param details the event details, or {@code null} for no details
     */
    public void record(String action, Long tenantId, Map<String, Object> details) {
        DirectwerkUserPrincipal principal = SecurityUtils.currentPrincipal();
        Long actorUserId = principal != null ? principal.userId() : null;
        Map<String, Object> eventDetails = details == null ? Map.of() : Map.copyOf(details);

        TransactionAfterCommit.run(() ->
                platformAuditEventWriter.write(action, tenantId, actorUserId, eventDetails));
    }
}
