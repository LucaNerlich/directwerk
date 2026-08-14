package de.pnnit.directwerk.modules.subscription.repository;

import de.pnnit.directwerk.modules.subscription.entity.ProcessedWebhookEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ProcessedWebhookEventRepository extends JpaRepository<ProcessedWebhookEvent, Long> {

    boolean existsByEventId(String eventId);
}
