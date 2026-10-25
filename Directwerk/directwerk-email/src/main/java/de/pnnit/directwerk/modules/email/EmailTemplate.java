package de.pnnit.directwerk.modules.email;

public enum EmailTemplate {
    TENANT_INVITATION(
            "email/tenant-invitation.html",
            "You've been invited to {{tenantName}}",
            EmailTokenLink.STUDIO_ACCEPT_INVITE
    ),
    PLATFORM_ADMIN_INVITATION(
            "email/platform-admin-invitation.html",
            "You've been invited as a platform administrator",
            EmailTokenLink.ADMIN_ACCEPT_INVITE
    ),
    PASSWORD_RESET(
            "email/password-reset.html",
            "Reset your password",
            EmailTokenLink.RESET_PASSWORD
    ),
    EMAIL_VERIFICATION(
            "email/email-verification.html",
            "Verify your email address",
            EmailTokenLink.EMAIL_VERIFICATION
    ),
    NEWSLETTER_CONFIRM(
            "email/newsletter-confirm.html",
            "Confirm your subscription to {{listName}}",
            EmailTokenLink.NEWSLETTER_CONFIRM
    ),
    CONTENT_EPISODE_PUBLISHED(
            "email/content-episode-published.html",
            "New episode: {{title}}",
            null
    ),
    /**
     * Issue #323: newsletter-list article notification. The unsubscribe link is derived at
     * delivery from a protected raw token instead of being embedded (and persisted) in the
     * queue payload. Its tokenless predecessor was removed in #741.
     */
    NEWSLETTER_ARTICLE_PUBLISHED(
            "email/content-article-published.html",
            "New post: {{title}}",
            EmailTokenLink.NEWSLETTER_UNSUBSCRIBE
    ),
    CONTACT_FORM(
            "email/contact-form.html",
            "Contact form: {{name}}",
            null
    ),
    RSS_BULK_IMPORT_FINISHED(
            "email/rss-bulk-import-finished.html",
            "RSS import finished: {{importedCount}} new, {{skippedCount}} skipped, {{failedCount}} failed",
            null
    ),
    /** Tenant-admin Mailgun connection check — sent via the normal email queue. */
    MAILGUN_CONNECTION_TEST(
            "email/mailgun-connection-test.html",
            "[TEST] Directwerk Mailgun / Mailgun-Test",
            null
    );

    private final String classpathPath;
    private final String subjectTemplate;
    private final EmailTokenLink tokenLink;

    EmailTemplate(String classpathPath, String subjectTemplate, EmailTokenLink tokenLink) {
        this.classpathPath = classpathPath;
        this.subjectTemplate = subjectTemplate;
        this.tokenLink = tokenLink;
    }

    public static EmailTemplate require(String name) {
        try {
            return valueOf(name);
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Unknown email template: " + name, ex);
        }
    }

    public String classpathPath() {
        return classpathPath;
    }

    public String subjectTemplate() {
        return subjectTemplate;
    }

    public EmailTokenLink tokenLink() {
        return tokenLink;
    }

    public boolean requiresToken() {
        return tokenLink != null;
    }
}
