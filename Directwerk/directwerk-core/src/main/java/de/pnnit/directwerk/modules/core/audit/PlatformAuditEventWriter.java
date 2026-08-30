package de.pnnit.directwerk.modules.core.audit;

import de.pnnit.directwerk.modules.core.entity.PlatformAuditEvent;
import de.pnnit.directwerk.modules.core.repository.PlatformAuditEventRepository;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
class PlatformAuditEventWriter {

    private final PlatformAuditEventRepository platformAuditEventRepository;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    void write(String action, Long tenantId, Long actorUserId, Map<String, Object> details) {
        PlatformAuditEvent event = new PlatformAuditEvent();
        event.setAction(action);
        event.setTenantId(tenantId);
        event.setDetails(details);
        event.setActorUserId(actorUserId);
        platformAuditEventRepository.save(event);
    }
}
