package de.pnnit.directwerk.modules.email;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.content.PublicContentPaths;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.core.service.TenantPublicHostResolver;
import de.pnnit.directwerk.modules.core.util.PublicContentUrlResolver;
import de.pnnit.directwerk.modules.core.util.PublicUrlBuilder;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class EmailLinkBuilder {

    private final DirectwerkConfig directwerkConfig;
    private final TenantPublicHostResolver tenantPublicHostResolver;
    private final TenantRepository tenantRepository;
    private final PublicContentUrlResolver publicContentUrlResolver;

    public EmailLinkBuilder(
            DirectwerkConfig directwerkConfig,
            TenantPublicHostResolver tenantPublicHostResolver,
            TenantRepository tenantRepository,
            PublicContentUrlResolver publicContentUrlResolver
    ) {
        this.directwerkConfig = directwerkConfig;
        this.tenantPublicHostResolver = tenantPublicHostResolver;
        this.tenantRepository = tenantRepository;
        this.publicContentUrlResolver = publicContentUrlResolver;
    }

    public String buildTokenUrl(EmailTemplate template, String rawToken, Long tenantId) {
        return switch (template.tokenLink()) {
            case STUDIO_ACCEPT_INVITE -> buildStudioAcceptInviteUrl(rawToken, tenantId);
            case ADMIN_ACCEPT_INVITE -> buildAdminAcceptInviteUrl(rawToken);
            case RESET_PASSWORD -> buildResetPasswordUrl(rawToken, tenantId);
            case EMAIL_VERIFICATION -> buildVerifyEmailUrl(rawToken, tenantId);
            case NEWSLETTER_CONFIRM -> buildNewsletterConfirmUrl(rawToken, tenantId);
            case NEWSLETTER_UNSUBSCRIBE -> publicContentUrlResolver.newsletterUnsubscribeUrl(tenantId, rawToken);
        };
    }

    public String buildStudioAcceptInviteUrl(String inviteToken, Long tenantId) {
        return buildUrl(
                directwerkConfig.email().studioBaseUrl(),
                directwerkConfig.email().acceptInvitePath(),
                inviteToken
        );
    }

    public String buildAdminAcceptInviteUrl(String inviteToken) {
        return buildUrl(
                directwerkConfig.email().adminBaseUrl(),
                directwerkConfig.email().acceptInvitePath(),
                inviteToken
        );
    }

    public String buildResetPasswordUrl(String resetToken, Long tenantId) {
        return buildTenantAuthUrl(
                tenantId,
                directwerkConfig.email().resetPasswordPath(),
                resetToken
        );
    }

    public String buildVerifyEmailUrl(String verificationToken, Long tenantId) {
        return buildTenantAuthUrl(
                tenantId,
                directwerkConfig.email().verifyEmailPath(),
                verificationToken
        );
    }

    public String buildNewsletterConfirmUrl(String confirmToken, Long tenantId) {
        return buildTenantAuthUrl(tenantId, PublicContentPaths.newsletterConfirm(), confirmToken);
    }

    private String buildTenantAuthUrl(Long tenantId, String path, String token) {
        String baseUrl = resolveTenantAuthBaseUrl(tenantId);
        String url = buildUrl(baseUrl, path, token);
        if (tenantId != null && tenantPublicHostResolver.findPrimaryVerifiedHost(tenantId).isEmpty()) {
            Tenant tenant = tenantRepository.findById(tenantId).orElse(null);
            if (tenant != null && StringUtils.hasText(tenant.getSlug())) {
                url += "&tenant=" + URLEncoder.encode(tenant.getSlug(), StandardCharsets.UTF_8);
            }
        }
        return url;
    }

    private String resolveTenantAuthBaseUrl(Long tenantId) {
        if (tenantId != null) {
            return tenantPublicHostResolver.findPrimaryVerifiedHost(tenantId)
                    .map(PublicUrlBuilder::publicOrigin)
                    .orElseGet(() -> trimTrailingSlash(directwerkConfig.email().studioBaseUrl()));
        }
        return trimTrailingSlash(directwerkConfig.email().studioBaseUrl());
    }

    private static String buildUrl(String baseUrl, String path, String token) {
        String normalizedBaseUrl = trimTrailingSlash(baseUrl);
        String normalizedPath = normalizePath(path);
        String encodedToken = URLEncoder.encode(token, StandardCharsets.UTF_8);
        return normalizedBaseUrl + normalizedPath + "?token=" + encodedToken;
    }

    private static String normalizePath(String path) {
        if (!StringUtils.hasText(path)) {
            return "/";
        }
        return path.startsWith("/") ? path : "/" + path;
    }

    private static String trimTrailingSlash(String value) {
        if (!StringUtils.hasText(value)) {
            return "";
        }
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }
}
