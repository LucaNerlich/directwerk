package de.pnnit.directwerk.modules.newsletter.exception;

public class NewsletterListNotFoundException extends RuntimeException {

    public NewsletterListNotFoundException(Long listId) {
        super("Newsletter list not found: " + listId);
    }

    public NewsletterListNotFoundException(String slug) {
        super("Newsletter list not found: " + slug);
    }
}
