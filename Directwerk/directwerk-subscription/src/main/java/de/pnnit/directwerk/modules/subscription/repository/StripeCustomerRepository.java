package de.pnnit.directwerk.modules.subscription.repository;

import de.pnnit.directwerk.modules.subscription.entity.StripeCustomer;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface StripeCustomerRepository extends JpaRepository<StripeCustomer, Long> {

    Optional<StripeCustomer> findByTenantIdAndUserId(Long tenantId, Long userId);
}
