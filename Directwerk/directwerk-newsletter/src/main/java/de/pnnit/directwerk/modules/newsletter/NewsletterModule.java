package de.pnnit.directwerk.modules.newsletter;

/**
 * Vertical slice for the Write desk: newsletter / article publications (blog posts, paid essays,
 * classic email newsletters).
 *
 * <p>A web-published post and an email newsletter issue are the same {@code Article} entity;
 * delivery differs (public site vs inbox). Optional email send on publish uses
 * {@code EMAIL_NOTIFY} and {@code directwerk-email}, not a separate content type.
 *
 * <p>Write operations are gated with {@code @RequiresModule(DigitalContentModule.KEY)} — the
 * {@code DIGITAL_CONTENT} feature flag, not {@code PODCAST}.
 */
public final class NewsletterModule {

    private NewsletterModule() {
    }
}
