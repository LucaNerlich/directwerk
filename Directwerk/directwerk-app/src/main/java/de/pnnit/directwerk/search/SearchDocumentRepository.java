package de.pnnit.directwerk.search;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SearchDocumentRepository extends JpaRepository<SearchDocument, Long> {

    List<SearchDocument> findByTenant_IdOrderByTitleAscIdAsc(Long tenantId);

    Optional<SearchDocument> findByTenant_IdAndKindAndSourceId(Long tenantId, String kind, Long sourceId);

    void deleteByTenant_IdAndKindAndSourceId(Long tenantId, String kind, Long sourceId);
}
