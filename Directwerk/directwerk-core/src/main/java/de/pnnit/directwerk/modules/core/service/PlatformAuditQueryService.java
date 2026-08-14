package de.pnnit.directwerk.modules.core.service;

import de.pnnit.directwerk.modules.core.entity.PlatformAuditEvent;
import de.pnnit.directwerk.modules.core.repository.PlatformAuditEventRepository;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PlatformAuditQueryService {

    private final PlatformAuditEventRepository platformAuditEventRepository;

    public List<PlatformAuditView> listRecent(int limit) {
        int pageSize = Math.min(Math.max(limit, 1), 100);
        return platformAuditEventRepository.findAllByOrderByCreatedAtDesc(PageRequest.of(0, pageSize))
                .stream()
                .map(this::toView)
                .toList();
    }

    private PlatformAuditView toView(PlatformAuditEvent event) {
        return new PlatformAuditView(
                event.getId(),
                event.getAction(),
                event.getActorUserId(),
                event.getTenantId(),
                event.getDetails() == null ? Map.of() : event.getDetails(),
                event.getCreatedAt()
        );
    }

    public record PlatformAuditView(
            Long id,
            String action,
            Long actorUserId,
            Long tenantId,
            Map<String, Object> details,
            Instant createdAt
    ) {
    }
}
