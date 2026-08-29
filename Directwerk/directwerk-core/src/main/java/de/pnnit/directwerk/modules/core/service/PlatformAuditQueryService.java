package de.pnnit.directwerk.modules.core.service;

import de.pnnit.directwerk.modules.core.entity.PlatformAuditEvent;
import de.pnnit.directwerk.modules.core.entity.User;
import de.pnnit.directwerk.modules.core.repository.PlatformAuditEventRepository;
import de.pnnit.directwerk.modules.core.repository.UserRepository;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PlatformAuditQueryService {

    private final PlatformAuditEventRepository platformAuditEventRepository;
    private final UserRepository userRepository;

    public List<PlatformAuditView> listRecent(int limit) {
        return list(new AuditQuery(0, limit, null, null, null)).content();
    }

    public AuditPage list(AuditQuery query) {
        int page = Math.max(query.page(), 0);
        int size = Math.min(Math.max(query.size(), 1), 100);

        Long actorUserId = query.actorUserId();
        if (actorUserId == null && StringUtils.hasText(query.actorEmail())) {
            actorUserId = userRepository.findByEmailIgnoreCase(query.actorEmail().trim())
                    .map(User::getId)
                    .orElse(-1L);
        }

        Page<PlatformAuditEvent> result = platformAuditEventRepository.findFiltered(
                query.tenantId(),
                StringUtils.hasText(query.action()) ? query.action().trim() : null,
                actorUserId,
                PageRequest.of(page, size)
        );

        Map<Long, String> actorEmails = resolveActorEmails(result.getContent());

        List<PlatformAuditView> content = result.getContent().stream()
                .map(event -> toView(event, actorEmails.get(event.getActorUserId())))
                .toList();

        return new AuditPage(
                content,
                result.getTotalElements(),
                page,
                size
        );
    }

    private Map<Long, String> resolveActorEmails(List<PlatformAuditEvent> events) {
        List<Long> actorIds = events.stream()
                .map(PlatformAuditEvent::getActorUserId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        if (actorIds.isEmpty()) {
            return Map.of();
        }

        Map<Long, String> actorEmails = HashMap.newHashMap(actorIds.size());
        userRepository.findAllById(actorIds).forEach(user -> actorEmails.put(user.getId(), user.getEmail()));
        return actorEmails;
    }

    private PlatformAuditView toView(PlatformAuditEvent event, String actorEmail) {
        return new PlatformAuditView(
                event.getId(),
                event.getAction(),
                event.getActorUserId(),
                actorEmail,
                event.getTenantId(),
                event.getDetails() == null ? Map.of() : event.getDetails(),
                event.getCreatedAt()
        );
    }

    public record AuditQuery(
            int page,
            int size,
            Long tenantId,
            String action,
            String actorEmail,
            Long actorUserId
    ) {
        public AuditQuery(int page, int size, Long tenantId, String action, String actorEmail) {
            this(page, size, tenantId, action, actorEmail, null);
        }
    }

    public record AuditPage(
            List<PlatformAuditView> content,
            long totalElements,
            int page,
            int size
    ) {
    }

    public record PlatformAuditView(
            Long id,
            String action,
            Long actorUserId,
            String actorEmail,
            Long tenantId,
            Map<String, Object> details,
            Instant createdAt
    ) {
    }
}
