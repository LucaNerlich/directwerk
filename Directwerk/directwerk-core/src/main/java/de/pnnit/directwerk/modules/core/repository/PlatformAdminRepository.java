package de.pnnit.directwerk.modules.core.repository;

import de.pnnit.directwerk.modules.core.entity.PlatformAdmin;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface PlatformAdminRepository extends JpaRepository<PlatformAdmin, Long> {

    /** Loads each admin's user with the page instead of one lazy select per row (#716). */
    @Override
    @EntityGraph(attributePaths = "user")
    Page<PlatformAdmin> findAll(Pageable pageable);

    Optional<PlatformAdmin> findByUserId(Long userId);

    /** Locks the administrator set so count-and-revoke decisions are serialized. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select admin from PlatformAdmin admin order by admin.id")
    List<PlatformAdmin> findAllForUpdate();
}
