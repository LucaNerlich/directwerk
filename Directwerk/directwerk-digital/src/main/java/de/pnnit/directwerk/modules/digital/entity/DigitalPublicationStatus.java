package de.pnnit.directwerk.modules.digital.entity;

import de.pnnit.directwerk.modules.content.PublicationPhase;
import de.pnnit.directwerk.modules.content.PublicationStatus;

public enum DigitalPublicationStatus implements PublicationStatus {
    DRAFT(PublicationPhase.DRAFT),
    PUBLISHED(PublicationPhase.PUBLISHED),
    ARCHIVED(PublicationPhase.ARCHIVED);

    private final PublicationPhase phase;

    DigitalPublicationStatus(PublicationPhase phase) {
        this.phase = phase;
    }

    @Override
    public PublicationPhase phase() {
        return phase;
    }
}
