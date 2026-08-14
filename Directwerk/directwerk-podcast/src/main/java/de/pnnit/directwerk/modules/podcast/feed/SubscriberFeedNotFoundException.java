package de.pnnit.directwerk.modules.podcast.feed;

public class SubscriberFeedNotFoundException extends RuntimeException {

    public SubscriberFeedNotFoundException() {
        super("Subscriber feed not found");
    }
}
