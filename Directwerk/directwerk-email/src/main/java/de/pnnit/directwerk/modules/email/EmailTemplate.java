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
    CONTENT_EPISODE_PUBLISHED(
            "email/content-episode-published.html",
            "New episode: {{title}}",
            null
    ),
    CONTENT_ARTICLE_PUBLISHED(
            "email/content-article-published.html",
            "New post: {{title}}",
            null
    ),
    CONTACT_FORM(
            "email/contact-form.html",
            "Contact form: {{name}}",
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
