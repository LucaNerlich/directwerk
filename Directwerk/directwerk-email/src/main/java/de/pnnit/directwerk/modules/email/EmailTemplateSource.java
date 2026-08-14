package de.pnnit.directwerk.modules.email;

/**
 * Resolves email template content, optionally scoped to a tenant for branding overrides.
 */
public interface EmailTemplateSource {

    String resolveBody(EmailTemplate template, Long tenantId);

    String resolveSubject(EmailTemplate template, Long tenantId);
}
