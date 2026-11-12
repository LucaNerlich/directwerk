package de.pnnit.directwerk.modules.podcast.entity;

import de.pnnit.directwerk.modules.content.PublicationPhase;
import de.pnnit.directwerk.modules.content.PublicationStatus;

public enum SeriesStatus implements PublicationStatus {
    DRAFT(PublicationPhase.DRAFT),
    PUBLISHED(PublicationPhase.PUBLISHED);

    private final PublicationPhase phase;

    SeriesStatus(PublicationPhase phase) {
        this.phase = phase;
    }

    @Override
    public PublicationPhase phase() {
        return phase;
    }
}
