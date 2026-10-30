package de.pnnit.directwerk.security;

import de.pnnit.directwerk.modules.core.service.TenantApiKeyService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.oauth2.server.resource.web.BearerTokenResolver;
import org.springframework.security.oauth2.server.resource.web.DefaultBearerTokenResolver;

/**
 * Lets {@link TenantApiKeyAuthenticationFilter} own {@code dwk_…} secrets by returning
 * {@code null} for those Bearer values so the JWT resource-server filter does not try to
 * decode them.
 */
public final class DirectwerkBearerTokenResolver implements BearerTokenResolver {

    private final DefaultBearerTokenResolver delegate = new DefaultBearerTokenResolver();

    @Override
    public String resolve(HttpServletRequest request) {
        String token = delegate.resolve(request);
        if (token != null && token.startsWith(TenantApiKeyService.KEY_PREFIX)) {
            return null;
        }
        return token;
    }
}
