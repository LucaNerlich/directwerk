package de.pnnit.directwerk.modules.digital.repository;

import de.pnnit.directwerk.modules.digital.entity.Category;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CategoryRepository extends JpaRepository<Category, Long> {

    @EntityGraph(attributePaths = "parent")
    List<Category> findByTenantIdOrderByNameAscIdAsc(Long tenantId);

    @EntityGraph(attributePaths = "parent")
    List<Category> findByTenantIdAndActiveTrueOrderByNameAscIdAsc(Long tenantId);

    @EntityGraph(attributePaths = "parent")
    Optional<Category> findByIdAndTenantId(Long id, Long tenantId);

    boolean existsByTenantIdAndSlug(Long tenantId, String slug);

    boolean existsByTenantIdAndSlugAndIdNot(Long tenantId, String slug, Long id);
}
