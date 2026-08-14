package de.pnnit.directwerk.modules.email.sender;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Fail-closed transport when no provider is selected or the selected provider is not implemented.
 */
public class NoneEmailSender implements EmailSender {

    private static final Logger log = LoggerFactory.getLogger(NoneEmailSender.class);

    @Override
    public String providerId() {
        return "none";
    }

    @Override
    public boolean isReady() {
        return false;
    }

    @Override
    public void send(OutboundEmail email) {
        log.debug("Email provider is none; skipping template={}", email == null ? null : email.template());
    }
}
