package de.pnnit.directwerk.modules.newsletter.repository;

import de.pnnit.directwerk.modules.newsletter.entity.NewsletterList;
import de.pnnit.directwerk.modules.newsletter.entity.NewsletterListStatus;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NewsletterListRepository extends JpaRepository<NewsletterList, Long> {

    List<NewsletterList> findByTenantIdOrderByNameAscIdAsc(Long tenantId);

    List<NewsletterList> findByTenantIdAndStatusOrderByNameAscIdAsc(Long tenantId, NewsletterListStatus status);

    Optional<NewsletterList> findByIdAndTenantId(Long id, Long tenantId);

    Optional<NewsletterList> findByTenantIdAndSlug(Long tenantId, String slug);

    boolean existsByTenantIdAndSlug(Long tenantId, String slug);

    boolean existsByTenantIdAndSlugAndIdNot(Long tenantId, String slug, Long id);
}
