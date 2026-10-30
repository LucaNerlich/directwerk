package de.pnnit.directwerk.security;

import de.pnnit.directwerk.modules.core.apikey.TenantApiKeyScopes;
import de.pnnit.directwerk.modules.core.service.TenantApiKeyService;
import de.pnnit.directwerk.modules.core.service.TenantApiKeyService.AuthenticatedApiKey;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.web.DefaultBearerTokenResolver;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Authenticates opaque {@code dwk_…} Bearer secrets before the JWT resource-server filter.
 * Authority mapping: {@code content:*} → EDITOR; {@code content:write} also gets
 * {@link TenantApiKeyScopes#CONTENT_WRITE_AUTHORITY} so formats/categories mutations pass
 * method security without impersonating {@code ROLE_TENANT_ADMIN}. Path access still refuses
 * {@code /api/v1/tenant/**} and deferred editor surfaces via {@link TenantApiKeyPathAccess}.
 */
@RequiredArgsConstructor
public class TenantApiKeyAuthenticationFilter extends OncePerRequestFilter {

    private final TenantApiKeyService tenantApiKeyService;
    private final ApiAuthenticationEntryPoint authenticationEntryPoint;
    private final DefaultBearerTokenResolver bearerTokenResolver = new DefaultBearerTokenResolver();

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        if (!SecurityUtils.isAuthenticated()) {
            String token = bearerTokenResolver.resolve(request);
            if (token != null && token.startsWith(TenantApiKeyService.KEY_PREFIX)) {
                Optional<AuthenticatedApiKey> authenticated = tenantApiKeyService.authenticate(token);
                if (authenticated.isEmpty()) {
                    // Do not fall through to JWT — opaque secret failed.
                    authenticationEntryPoint.commence(
                            request,
                            response,
                            new org.springframework.security.authentication.BadCredentialsException(
                                    "Invalid API key"
                            )
                    );
                    return;
                }
                AuthenticatedApiKey key = authenticated.get();
                List<SimpleGrantedAuthority> authorities = authoritiesFor(key.scopes());
                DirectwerkUserPrincipal principal = new DirectwerkUserPrincipal(
                        key.createdByUserId(),
                        key.createdByEmail(),
                        null,
                        key.tenantId(),
                        authorities
                );
                TenantApiKeyAuthenticationToken authentication = new TenantApiKeyAuthenticationToken(
                        principal,
                        key.keyId(),
                        key.scopes(),
                        authorities
                );
                SecurityContextHolder.getContext().setAuthentication(authentication);
            }
        }
        filterChain.doFilter(request, response);
    }

    static List<SimpleGrantedAuthority> authoritiesFor(java.util.Set<String> scopes) {
        List<SimpleGrantedAuthority> authorities = new ArrayList<>();
        if (TenantApiKeyScopes.allowsRead(scopes)) {
            authorities.add(new SimpleGrantedAuthority(RoleConstants.EDITOR));
        }
        if (TenantApiKeyScopes.allowsWrite(scopes)) {
            // Narrow authority for taxonomy mutations — never ROLE_TENANT_ADMIN, so
            // /api/v1/tenant/** stays denied at the SecurityConfig matcher layer.
            authorities.add(new SimpleGrantedAuthority(TenantApiKeyScopes.CONTENT_WRITE_AUTHORITY));
        }
        return authorities;
    }
}
