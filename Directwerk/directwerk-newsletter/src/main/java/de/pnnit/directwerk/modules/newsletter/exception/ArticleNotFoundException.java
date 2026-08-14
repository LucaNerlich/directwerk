package de.pnnit.directwerk.modules.newsletter.exception;

public class ArticleNotFoundException extends RuntimeException {

    public ArticleNotFoundException(Long id) {
        super("Article not found: " + id);
    }

    public ArticleNotFoundException(String slug) {
        super("Article not found: " + slug);
    }
}
