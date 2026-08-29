package de.pnnit.directwerk.modules.marketing;

public class ContactFormDisabledException extends RuntimeException {

    public ContactFormDisabledException() {
        super("Contact form is not available");
    }
}
