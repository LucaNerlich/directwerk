package de.pnnit.directwerk.modules.email.sender;

/**
 * Transport port for a rendered email. Swap implementations (SMTP, HTTP ESP, none)
 * without changing jobs, templates, or domain notifiers.
 */
public interface EmailSender {

    String providerId();

    boolean isReady();

    void send(OutboundEmail email);
}
