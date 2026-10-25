package de.pnnit.directwerk.modules.email.esp;

import de.pnnit.directwerk.modules.core.exception.CodedStatusException;

/** Tenant has no active Mailgun ESP connection for sending. */
public class MailgunNotConfiguredException extends CodedStatusException {

    public MailgunNotConfiguredException(String message) {
        super(400, "MAILGUN_NOT_CONFIGURED", message);
    }
}
