package de.pnnit.directwerk.modules.newsletter.exception;

import de.pnnit.directwerk.modules.core.exception.CodedStatusException;

public class ArticleRssImportException extends CodedStatusException {

    public ArticleRssImportException(int status, String code, String message) {
        super(status, code, message);
    }

    public ArticleRssImportException(int status, String code, String message, Throwable cause) {
        super(status, code, message, cause);
    }
}
