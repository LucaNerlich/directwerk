package de.pnnit.directwerk.modules.newsletter.feed;

public class ArticleFeedNotFoundException extends RuntimeException {

    public ArticleFeedNotFoundException() {
        super("Article feed not found");
    }
}
