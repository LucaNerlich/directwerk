package de.pnnit.directwerk.modules.podcast.exception;

import de.pnnit.directwerk.modules.core.exception.CodedStatusException;

public class RssImportException extends CodedStatusException {

    public RssImportException(int status, String code, String message) {
        super(status, code, message);
    }

    public RssImportException(int status, String code, String message, Throwable cause) {
        super(status, code, message, cause);
    }
}
