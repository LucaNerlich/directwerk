package de.pnnit.directwerk.modules.core.repository;

import de.pnnit.directwerk.modules.core.entity.PlatformAuditEvent;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface PlatformAuditEventRepository extends JpaRepository<PlatformAuditEvent, Long> {

    List<PlatformAuditEvent> findAllByOrderByCreatedAtDesc(Pageable pageable);

    @Query("""
            select event from PlatformAuditEvent event
            where (:tenantId is null or event.tenantId = :tenantId)
              and (:action is null or event.action = :action)
              and (:actorUserId is null or event.actorUserId = :actorUserId)
            order by event.createdAt desc, event.id desc
            """)
    Page<PlatformAuditEvent> findFiltered(
            @Param("tenantId") Long tenantId,
            @Param("action") String action,
            @Param("actorUserId") Long actorUserId,
            Pageable pageable
    );
}

