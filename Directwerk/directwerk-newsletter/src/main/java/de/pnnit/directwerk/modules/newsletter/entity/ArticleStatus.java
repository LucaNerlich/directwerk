package de.pnnit.directwerk.modules.newsletter.entity;

import de.pnnit.directwerk.modules.content.PublicationPhase;
import de.pnnit.directwerk.modules.content.PublicationStatus;

public enum ArticleStatus implements PublicationStatus {
    DRAFT(PublicationPhase.DRAFT),
    SCHEDULED(PublicationPhase.SCHEDULED),
    PUBLISHED(PublicationPhase.PUBLISHED),
    ARCHIVED(PublicationPhase.ARCHIVED);

    private final PublicationPhase phase;

    ArticleStatus(PublicationPhase phase) {
        this.phase = phase;
    }

    @Override
    public PublicationPhase phase() {
        return phase;
    }
}
