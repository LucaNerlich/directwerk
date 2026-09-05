package de.pnnit.directwerk.modules.core.repository;

import de.pnnit.directwerk.modules.core.entity.PlatformAdmin;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface PlatformAdminRepository extends JpaRepository<PlatformAdmin, Long> {

    Optional<PlatformAdmin> findByUserId(Long userId);

    /** Locks the administrator set so count-and-revoke decisions are serialized. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select admin from PlatformAdmin admin order by admin.id")
    List<PlatformAdmin> findAllForUpdate();
}
