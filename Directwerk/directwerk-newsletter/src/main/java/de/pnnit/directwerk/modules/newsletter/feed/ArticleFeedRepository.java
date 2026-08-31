package de.pnnit.directwerk.modules.newsletter.feed;

import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.stereotype.Repository;

@Repository
public interface ArticleFeedRepository extends JpaRepository<ArticleFeed, Long> {

    @EntityGraph(attributePaths = {"tenant", "user", "categories"})
    Optional<ArticleFeed> findByFeedToken(String feedToken);

    @EntityGraph(attributePaths = {"tenant", "user", "categories"})
    Optional<ArticleFeed> findByTenantIdAndUserIdAndDefaultFeedTrue(Long tenantId, Long userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = {"tenant", "user", "categories"})
    Optional<ArticleFeed> findWithLockByTenantIdAndUserIdAndDefaultFeedTrue(Long tenantId, Long userId);

    @EntityGraph(attributePaths = {"tenant", "user", "categories"})
    List<ArticleFeed> findByTenantIdAndUserIdOrderByDefaultFeedDescIdAsc(Long tenantId, Long userId);

    @EntityGraph(attributePaths = {"tenant", "user", "categories"})
    Optional<ArticleFeed> findByIdAndTenantId(Long id, Long tenantId);

    @EntityGraph(attributePaths = {"tenant", "user", "categories"})
    Optional<ArticleFeed> findByIdAndTenantIdAndUserId(Long id, Long tenantId, Long userId);

    @EntityGraph(attributePaths = {"tenant", "user", "categories"})
    List<ArticleFeed> findByTenantIdOrderByIdAsc(Long tenantId);

    boolean existsByFeedToken(String feedToken);

    long countByTenantIdAndUserIdAndDefaultFeedFalse(Long tenantId, Long userId);

    boolean existsByTenantIdAndUserIdAndDefaultFeedFalseAndTitleIgnoreCase(
            Long tenantId,
            Long userId,
            String title
    );

    boolean existsByTenantIdAndUserIdAndDefaultFeedFalseAndIdNotAndTitleIgnoreCase(
            Long tenantId,
            Long userId,
            Long id,
            String title
    );
}
