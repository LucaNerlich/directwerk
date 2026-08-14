package de.pnnit.directwerk.modules.email.content;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.content.ContentPublishedEvent;
import de.pnnit.directwerk.modules.content.ContentPublishedNotifier;
import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import de.pnnit.directwerk.modules.email.EmailNotifyModule;
import de.pnnit.directwerk.modules.queue.JobEnqueueMetadata;
import de.pnnit.directwerk.modules.queue.QueueJob;
import de.pnnit.directwerk.modules.queue.QueueNames;
import de.pnnit.directwerk.modules.queue.QueueService;
import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

@Service
public class ContentNotifyJobProducer implements ContentPublishedNotifier {

    private static final Logger log = LoggerFactory.getLogger(ContentNotifyJobProducer.class);

    private final DirectwerkConfig directwerkConfig;
    private final ModuleGateService moduleGateService;
    private final QueueService queueService;
    private final ObjectMapper objectMapper;

    public ContentNotifyJobProducer(
            DirectwerkConfig directwerkConfig,
            ModuleGateService moduleGateService,
            QueueService queueService,
            ObjectMapper objectMapper
    ) {
        this.directwerkConfig = directwerkConfig;
        this.moduleGateService = moduleGateService;
        this.queueService = queueService;
        this.objectMapper = objectMapper;
    }

    @Override
    public void notifyContentPublished(ContentPublishedEvent event) {
        if (!directwerkConfig.isEmailEnabled()) {
            log.debug("Email delivery disabled; skipping content notification");
            return;
        }
        if (!moduleGateService.enabledModuleKeys(event.tenantId()).contains(EmailNotifyModule.KEY)) {
            log.debug("EMAIL_NOTIFY module off for tenant={}; skipping content notification", event.tenantId());
            return;
        }

        ContentNotifyJobPayload payload = ContentNotifyJobPayload.from(
                event.contentType(),
                event.contentId(),
                event.title(),
                event.excerpt(),
                event.slug(),
                event.accessPolicy()
        );
        String correlationId = "content-notify-%s-%d".formatted(event.contentType().name().toLowerCase(Locale.ROOT), event.contentId());
        QueueJob job = queueService.enqueue(
                QueueNames.CONTENT_NOTIFY,
                objectMapper.valueToTree(payload),
                0,
                null,
                null,
                new JobEnqueueMetadata(event.tenantId(), correlationId, null)
        );
        log.info(
                "Enqueued content notification job id={} tenant={} type={} contentId={}",
                job.id(),
                event.tenantId(),
                event.contentType(),
                event.contentId()
        );
    }
}
