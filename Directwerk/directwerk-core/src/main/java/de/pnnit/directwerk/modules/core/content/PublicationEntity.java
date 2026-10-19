package de.pnnit.directwerk.modules.core.content;

import de.pnnit.directwerk.modules.core.entity.Tenant;
import java.time.Instant;

/**
 * The state every publishable content entity exposes to {@link PublicationWorkflow}.
 *
 * <p>Podcast episodes and newsletter articles carry the same lifecycle columns; this
 * interface is what lets the workflow read and advance them without knowing the entity
 * or its status enum.</p>
 *
 * @param <STATUS> the module's lifecycle enum
 */
public interface PublicationEntity<STATUS> {

    Long getId();

    Long getCreatedBy();

    String getTitle();

    String getSlug();

    STATUS getStatus();

    void setStatus(STATUS status);

    Instant getPublishedAt();

    void setPublishedAt(Instant publishedAt);

    Instant getScheduledAt();

    void setScheduledAt(Instant scheduledAt);

    boolean isNotifySubscribersOnPublish();

    void setNotifySubscribersOnPublish(boolean notifySubscribersOnPublish);

    void setEmailNotifiedAt(Instant emailNotifiedAt);

    Tenant getTenant();
}
