package de.pnnit.directwerk.modules.newsletter.exception;

public class NewsletterListNotFoundException extends RuntimeException {

    private final Long listId;
    private final String slug;

    public NewsletterListNotFoundException(Long listId) {
        super("Newsletter list not found: " + listId);
        this.listId = listId;
        this.slug = null;
    }

    public NewsletterListNotFoundException(String slug) {
        super("Newsletter list not found: " + slug);
        this.listId = null;
        this.slug = slug;
    }

    public Long getListId() {
        return listId;
    }

    public String getSlug() {
        return slug;
    }
}
