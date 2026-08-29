package de.pnnit.directwerk.modules.core.notification;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.content.ContentType;
import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * Shared preconditions for subscriber notifications on publish. Both content workflows must
 * apply the same gates before claiming/notifying — one home so a new gate cannot be added to
 * one content type and missed in the other.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class SubscriberNotificationGate {

    private static final String EMAIL_NOTIFY_MODULE_KEY = "EMAIL_NOTIFY";

    private final DirectwerkConfig directwerkConfig;
    private final ModuleGateService moduleGateService;

    /**
     * Whether this tenant can offer or deliver subscriber email notifications right now.
     */
    public boolean availableForTenant(Long tenantId) {
        if (!directwerkConfig.isEmailEnabled()) {
            return false;
        }
        return moduleGateService.enabledModuleKeys(tenantId).contains(EMAIL_NOTIFY_MODULE_KEY);
    }

    /**
     * Whether subscriber notifications may go out for this tenant right now.
     * Logs the skip reason at debug, mirroring previous per-workflow behaviour.
     */
    public boolean enabled(Long tenantId, ContentType contentType, Long contentId) {
        if (!availableForTenant(tenantId)) {
            if (!directwerkConfig.isEmailEnabled()) {
                log.debug("Skipping {} notification tenant={} content={} — email delivery disabled",
                        contentType, tenantId, contentId);
            } else {
                log.debug("Skipping {} notification tenant={} content={} — EMAIL_NOTIFY module not enabled",
                        contentType, tenantId, contentId);
            }
            return false;
        }
        return true;
    }
}
