package de.pnnit.directwerk.modules.podcast.repository;

import de.pnnit.directwerk.modules.podcast.entity.Format;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface FormatRepository extends JpaRepository<Format, Long> {

    List<Format> findByTenantIdOrderBySortOrderAscIdAsc(Long tenantId);

    List<Format> findByTenantIdAndActiveTrueOrderBySortOrderAscIdAsc(Long tenantId);

    Optional<Format> findByIdAndTenantId(Long id, Long tenantId);

    boolean existsByTenantIdAndSlug(Long tenantId, String slug);

    boolean existsByTenantIdAndSlugAndIdNot(Long tenantId, String slug, Long id);

    long countByTenantIdAndActiveTrue(Long tenantId);
}
