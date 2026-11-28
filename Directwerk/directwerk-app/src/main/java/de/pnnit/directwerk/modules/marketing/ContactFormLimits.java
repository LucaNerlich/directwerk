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
    // The field limits are characters, but the pre-deserialization gate compares UTF-8 bytes;
    // size the text fields for the four-byte worst case so a valid CJK/emoji message fits.
    public static final int MAX_REQUEST_BODY_BYTES =
            512 + 4 * (NAME_MAX + EMAIL_MAX + MESSAGE_MAX) + ALTCHA_PAYLOAD_MAX;

    private ContactFormLimits() {
    }
}
