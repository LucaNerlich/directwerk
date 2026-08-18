package de.pnnit.directwerk.modules.podcast.feed;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SubscriberFeedRepository extends JpaRepository<SubscriberFeed, Long> {

    @EntityGraph(attributePaths = {"tenant", "user", "formats"})
    Optional<SubscriberFeed> findByFeedToken(String feedToken);

    @EntityGraph(attributePaths = {"tenant", "user", "formats"})
    Optional<SubscriberFeed> findByTenantIdAndUserIdAndDefaultFeedTrue(Long tenantId, Long userId);

    @EntityGraph(attributePaths = {"tenant", "user", "formats"})
    List<SubscriberFeed> findByTenantIdAndUserIdOrderByDefaultFeedDescIdAsc(Long tenantId, Long userId);

    @EntityGraph(attributePaths = {"tenant", "user", "formats"})
    Optional<SubscriberFeed> findByIdAndTenantId(Long id, Long tenantId);

    @EntityGraph(attributePaths = {"tenant", "user", "formats"})
    Optional<SubscriberFeed> findByIdAndTenantIdAndUserId(Long id, Long tenantId, Long userId);

    @EntityGraph(attributePaths = {"tenant", "user", "formats"})
    List<SubscriberFeed> findByTenantIdOrderByIdAsc(Long tenantId);

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
