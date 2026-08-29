package de.pnnit.directwerk.modules.stripebilling.repository;

import de.pnnit.directwerk.modules.stripebilling.entity.TenantStripeAccount;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface TenantStripeAccountRepository extends JpaRepository<TenantStripeAccount, Long> {

    Optional<TenantStripeAccount> findByTenantId(Long tenantId);

    @Query("""
            SELECT account FROM TenantStripeAccount account
            JOIN FETCH account.tenant
            WHERE account.stripeAccountId = :stripeAccountId
            """)
    Optional<TenantStripeAccount> findByStripeAccountId(@Param("stripeAccountId") String stripeAccountId);
}
