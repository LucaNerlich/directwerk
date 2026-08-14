package de.pnnit.directwerk.modules.core.repository;

import de.pnnit.directwerk.modules.core.entity.PlatformAuditEvent;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface PlatformAuditEventRepository extends JpaRepository<PlatformAuditEvent, Long> {

    List<PlatformAuditEvent> findAllByOrderByCreatedAtDesc(Pageable pageable);
}

