package de.pnnit.directwerk.modules.newsletter.repository;

import de.pnnit.directwerk.modules.newsletter.entity.Article;
import de.pnnit.directwerk.modules.newsletter.entity.ArticleStatus;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ArticleRepository extends JpaRepository<Article, Long> {

    // open-in-view=false: heroAsset.tenant for any CDN/access on hero; tenant for scheduled publish.
    @EntityGraph(attributePaths = {
            "tenant", "heroAsset", "heroAsset.tenant", "categories", "categories.parent"
    })
    List<Article> findByTenantIdOrderByCreatedAtDescIdDesc(Long tenantId);

    @EntityGraph(attributePaths = {
            "tenant", "heroAsset", "heroAsset.tenant", "categories", "categories.parent"
    })
    Optional<Article> findByIdAndTenantId(Long id, Long tenantId);

    @EntityGraph(attributePaths = {
            "tenant", "heroAsset", "heroAsset.tenant", "categories", "categories.parent"
    })
    Optional<Article> findByTenantIdAndSlug(Long tenantId, String slug);

    boolean existsByTenantIdAndSlug(Long tenantId, String slug);

    boolean existsByTenantIdAndSlugAndIdNot(Long tenantId, String slug, Long id);

    @EntityGraph(attributePaths = {
            "tenant", "heroAsset", "heroAsset.tenant", "categories", "categories.parent"
    })
    List<Article> findByTenantIdAndStatusOrderByPublishedAtDescIdDesc(Long tenantId, ArticleStatus status);

    @EntityGraph(attributePaths = {
            "tenant", "heroAsset", "heroAsset.tenant", "categories", "categories.parent"
    })
    List<Article> findByStatusAndScheduledAtLessThanEqualOrderByScheduledAtAscIdAsc(
            ArticleStatus status,
            Instant scheduledAt
    );

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            update Article a
            set a.emailNotifiedAt = :notifiedAt
            where a.id = :articleId
              and a.tenant.id = :tenantId
              and a.emailNotifiedAt is null
            """)
    int claimEmailNotification(
            @Param("tenantId") Long tenantId,
            @Param("articleId") Long articleId,
            @Param("notifiedAt") Instant notifiedAt
    );
}
