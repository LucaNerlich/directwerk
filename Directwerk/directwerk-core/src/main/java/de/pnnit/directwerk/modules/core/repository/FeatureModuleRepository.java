package de.pnnit.directwerk.modules.core.repository;

import de.pnnit.directwerk.modules.core.entity.FeatureModule;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FeatureModuleRepository extends JpaRepository<FeatureModule, Long> {

    Optional<FeatureModule> findByModuleKey(String moduleKey);

    List<FeatureModule> findByPlatformActiveTrueOrderByModuleKeyAsc();
}
