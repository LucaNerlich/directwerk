package de.pnnit.directwerk.modules.email.repository;

import de.pnnit.directwerk.modules.email.entity.TenantEspConnection;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TenantEspConnectionRepository extends JpaRepository<TenantEspConnection, Long> {

    Optional<TenantEspConnection> findByTenant_Id(Long tenantId);
}
