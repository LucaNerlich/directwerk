package de.pnnit.directwerk.modules.newsletter.repository;

import de.pnnit.directwerk.modules.newsletter.entity.NewsletterSubscription;
import de.pnnit.directwerk.modules.newsletter.entity.NewsletterSubscriptionStatus;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface NewsletterSubscriptionRepository extends JpaRepository<NewsletterSubscription, Long> {

    Optional<NewsletterSubscription> findByIdAndTenantIdAndListId(Long id, Long tenantId, Long listId);

    Optional<NewsletterSubscription> findByListIdAndEmail(Long listId, String email);

    Optional<NewsletterSubscription> findByConfirmTokenHash(String confirmTokenHash);

    Optional<NewsletterSubscription> findByUnsubscribeTokenHash(String unsubscribeTokenHash);

    boolean existsByConfirmTokenHash(String confirmTokenHash);

    boolean existsByUnsubscribeTokenHash(String unsubscribeTokenHash);

    /** Paged listing so a large list does not materialize every subscriber email at once (#324). */
    List<NewsletterSubscription> findByListIdAndTenantIdOrderByCreatedAtDescIdDesc(
            Long listId, Long tenantId, Pageable pageable);

    List<NewsletterSubscription> findByTenantIdAndEmail(Long tenantId, String email);

    long countByListIdAndStatus(Long listId, NewsletterSubscriptionStatus status);

    /**
     * Issue #376: one grouped aggregate for a whole page of lists, instead of two count queries
     * per list. Rows are {@code [listId, status, count]}.
     */
    @Query("""
            select s.list.id, s.status, count(s)
            from NewsletterSubscription s
            where s.list.id in :listIds
            group by s.list.id, s.status
            """)
    List<Object[]> countByListIdInGroupedByStatus(@Param("listIds") Collection<Long> listIds);

    @Query("""
            select s from NewsletterSubscription s
            join fetch s.list
            where s.list.id in :listIds
              and s.tenant.id = :tenantId
              and s.status = de.pnnit.directwerk.modules.newsletter.entity.NewsletterSubscriptionStatus.ACTIVE
            order by s.id asc
            """)
    List<NewsletterSubscription> findActiveByTenantIdAndListIdIn(
            @Param("tenantId") Long tenantId,
            @Param("listIds") Collection<Long> listIds
    );
}
