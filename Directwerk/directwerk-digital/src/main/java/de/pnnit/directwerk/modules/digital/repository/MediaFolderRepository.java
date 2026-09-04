package de.pnnit.directwerk.modules.digital.repository;

import de.pnnit.directwerk.modules.digital.entity.MediaFolder;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface MediaFolderRepository extends JpaRepository<MediaFolder, Long> {

    @EntityGraph(attributePaths = "parent")
    List<MediaFolder> findByTenantIdOrderByNameAscIdAsc(Long tenantId);

    @EntityGraph(attributePaths = "parent")
    Optional<MediaFolder> findByIdAndTenantId(Long id, Long tenantId);

    @EntityGraph(attributePaths = "parent")
    List<MediaFolder> findByTenantIdAndParentId(Long tenantId, MediaFolder parent);

    @EntityGraph(attributePaths = "parent")
    List<MediaFolder> findByTenantIdAndParentIdIsNull(Long tenantId);

    boolean existsByTenantIdAndParentIdIsNullAndName(Long tenantId, String name);

    boolean existsByTenantIdAndParentIdAndName(Long tenantId, MediaFolder parent, String name);

    boolean existsByTenantIdAndParentIdIsNullAndNameAndIdNot(Long tenantId, String name, Long id);

    boolean existsByTenantIdAndParentIdAndNameAndIdNot(
            Long tenantId, MediaFolder parent, String name, Long id);
}
