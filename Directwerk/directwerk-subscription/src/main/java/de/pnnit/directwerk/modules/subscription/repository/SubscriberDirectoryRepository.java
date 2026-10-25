package de.pnnit.directwerk.modules.subscription.repository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Query;
import java.util.List;
import org.springframework.stereotype.Repository;

/**
 * Id-level union for the subscriber directory (#561).
 *
 * <p>Rows are the distinct union of role-SUBSCRIBER memberships and subscription owners.
 * A plain {@code Pageable} on one repository cannot express that, so paging happens here
 * on the union of user ids before the page is hydrated.
 */
@Repository
public class SubscriberDirectoryRepository {

    @PersistenceContext
    private EntityManager entityManager;

    /**
     * One page of distinct subscriber user ids for a tenant, optionally filtered.
     *
     * @param includeSubscriptions when false, only role-SUBSCRIBER members are included
     *                             (module inactive — mirrors the previous in-memory path)
     * @param queryBlank           when true, the search pattern is ignored
     * @param pattern              already-wrapped {@code %term%} pattern for LIKE
     */
    @SuppressWarnings("unchecked")
    public List<Long> findSubscriberUserIds(
            Long tenantId,
            boolean includeSubscriptions,
            boolean queryBlank,
            String pattern,
            int offset,
            int limit
    ) {
        Query query = entityManager.createNativeQuery(directorySql(false, includeSubscriptions));
        bindDirectoryParams(query, tenantId, includeSubscriptions, queryBlank, pattern);
        query.setParameter("offset", offset);
        query.setParameter("limit", limit);
        return ((List<Number>) query.getResultList()).stream()
                .map(Number::longValue)
                .toList();
    }

    public long countSubscriberUserIds(
            Long tenantId,
            boolean includeSubscriptions,
            boolean queryBlank,
            String pattern
    ) {
        Query query = entityManager.createNativeQuery(directorySql(true, includeSubscriptions));
        bindDirectoryParams(query, tenantId, includeSubscriptions, queryBlank, pattern);
        Number count = (Number) query.getSingleResult();
        return count.longValue();
    }

    private static String directorySql(boolean countOnly, boolean includeSubscriptions) {
        String roleBranch = """
                SELECT m.user_id AS user_id
                FROM tenant_memberships m
                JOIN users u ON u.id = m.user_id
                WHERE m.tenant_id = :tenantId
                  AND m.roles @> '"SUBSCRIBER"'::jsonb
                  AND (
                    CAST(:queryBlank AS boolean)
                    OR lower(u.email) LIKE :pattern
                    OR lower(coalesce(u.name, '')) LIKE :pattern
                    OR (
                      CAST(:includeSubscriptions AS boolean)
                      AND EXISTS (
                        SELECT 1
                        FROM subscriptions s
                        JOIN subscription_products p ON p.id = s.product_id
                        WHERE s.tenant_id = :tenantId
                          AND s.user_id = m.user_id
                          AND lower(p.title) LIKE :pattern
                      )
                    )
                  )
                """;

        String subscriptionBranch = includeSubscriptions
                ? """
                UNION
                SELECT s.user_id AS user_id
                FROM subscriptions s
                JOIN users u ON u.id = s.user_id
                JOIN subscription_products p ON p.id = s.product_id
                WHERE s.tenant_id = :tenantId
                  AND (
                    CAST(:queryBlank AS boolean)
                    OR lower(u.email) LIKE :pattern
                    OR lower(coalesce(u.name, '')) LIKE :pattern
                    OR lower(p.title) LIKE :pattern
                  )
                """
                : "";

        String unionBody = roleBranch + subscriptionBranch;
        if (countOnly) {
            return "SELECT count(*) FROM (" + unionBody + ") directory";
        }
        return """
                SELECT user_id FROM (
                """ + unionBody + """
                ) directory
                ORDER BY user_id ASC
                OFFSET :offset
                LIMIT :limit
                """;
    }

    private static void bindDirectoryParams(
            Query query,
            Long tenantId,
            boolean includeSubscriptions,
            boolean queryBlank,
            String pattern
    ) {
        query.setParameter("tenantId", tenantId);
        query.setParameter("includeSubscriptions", includeSubscriptions);
        query.setParameter("queryBlank", queryBlank);
        query.setParameter("pattern", pattern);
    }
}
