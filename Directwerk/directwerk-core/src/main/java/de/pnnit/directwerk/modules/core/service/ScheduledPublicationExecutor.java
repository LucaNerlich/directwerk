package de.pnnit.directwerk.modules.core.service;

import de.pnnit.directwerk.modules.content.ScheduledPublishing;
import java.util.List;
import java.util.function.BiConsumer;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Shared scheduled publication executor: module gate + due-item loop for content types.
 */
@Component
@RequiredArgsConstructor
public class ScheduledPublicationExecutor {

    private final ModuleGateService moduleGateService;

    public int publishDue(
            String moduleKey,
            List<ScheduledPublishing.DueItem> dueItems,
            BiConsumer<Long, Long> publishOne,
            String contentTypeLabel
    ) {
        return ScheduledPublishing.publishDue(
                dueItems,
                (tenantId, contentId) -> {
                    moduleGateService.requireModule(moduleKey);
                    publishOne.accept(tenantId, contentId);
                },
                contentTypeLabel
        );
    }
}
