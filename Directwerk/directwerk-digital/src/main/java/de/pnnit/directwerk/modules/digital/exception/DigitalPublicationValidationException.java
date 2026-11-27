package de.pnnit.directwerk.modules.digital.exception;

import de.pnnit.directwerk.modules.core.exception.CodedStatusException;

/** Client-facing validation failure for a digital publication (status 400, message echoed). */
public class DigitalPublicationValidationException extends CodedStatusException {

    public DigitalPublicationValidationException(String code, String message) {
        super(400, code, message);
    }
}
