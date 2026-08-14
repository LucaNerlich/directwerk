package de.pnnit.directwerk.modules.email;

import de.pnnit.directwerk.config.DirectwerkConfig;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class EmailLinkBuilder {

    private final DirectwerkConfig directwerkConfig;

    public EmailLinkBuilder(DirectwerkConfig directwerkConfig) {
        this.directwerkConfig = directwerkConfig;
    }

    public String buildTokenUrl(EmailTemplate template, String rawToken) {
        return switch (template.tokenLink()) {
            case STUDIO_ACCEPT_INVITE -> buildStudioAcceptInviteUrl(rawToken);
            case ADMIN_ACCEPT_INVITE -> buildAdminAcceptInviteUrl(rawToken);
            case RESET_PASSWORD -> buildResetPasswordUrl(rawToken);
            case EMAIL_VERIFICATION -> buildVerifyEmailUrl(rawToken);
        };
    }

    public String buildStudioAcceptInviteUrl(String inviteToken) {
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

    public String buildResetPasswordUrl(String resetToken) {
        return buildUrl(
                directwerkConfig.email().studioBaseUrl(),
                directwerkConfig.email().resetPasswordPath(),
                resetToken
        );
    }

    public String buildVerifyEmailUrl(String verificationToken) {
        return buildUrl(
                directwerkConfig.email().studioBaseUrl(),
                directwerkConfig.email().verifyEmailPath(),
                verificationToken
        );
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
