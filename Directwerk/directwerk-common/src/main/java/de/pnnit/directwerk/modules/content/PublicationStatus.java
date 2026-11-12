package de.pnnit.directwerk.modules.content;

/**
 * A module status enum that maps onto the shared {@link PublicationPhase}.
 * Implemented by episode, article and bonus-file statuses.
 */
public interface PublicationStatus {

    PublicationPhase phase();
}
