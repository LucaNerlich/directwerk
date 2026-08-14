package de.pnnit.directwerk.modules.core.repository;

import de.pnnit.directwerk.modules.core.entity.PlatformAdmin;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PlatformAdminRepository extends JpaRepository<PlatformAdmin, Long> {

    Optional<PlatformAdmin> findByUserId(Long userId);
}
