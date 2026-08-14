package de.pnnit.directwerk.modules.content;

/**
 * Port for enqueueing subscriber content-notification work without coupling
 * publication modules to the email transport.
 */
public interface ContentPublishedNotifier {

    void notifyContentPublished(ContentPublishedEvent event);
}
