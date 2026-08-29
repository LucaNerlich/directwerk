package de.pnnit.directwerk.modules.marketing;

/**
 * Shared validation and transport limits for the public contact form JSON body.
 */
public final class ContactFormLimits {

    public static final int NAME_MAX = 120;
    public static final int EMAIL_MAX = 254;
    public static final int MESSAGE_MAX = 5000;
    public static final int ALTCHA_PAYLOAD_MAX = 8192;

    /** Upper bound for {@code POST /api/v1/public/contact} before JSON deserialization. */
    public static final int MAX_REQUEST_BODY_BYTES =
            512 + NAME_MAX + EMAIL_MAX + MESSAGE_MAX + ALTCHA_PAYLOAD_MAX;

    private ContactFormLimits() {
    }
}
