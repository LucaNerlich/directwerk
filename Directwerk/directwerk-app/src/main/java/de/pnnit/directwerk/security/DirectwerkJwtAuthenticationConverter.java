package de.pnnit.directwerk.security;

import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.stereotype.Component;

@Component
public class DirectwerkJwtAuthenticationConverter implements Converter<Jwt, AbstractAuthenticationToken> {

    private final JwtGrantedAuthoritiesConverter authoritiesConverter;

    public DirectwerkJwtAuthenticationConverter() {
        JwtGrantedAuthoritiesConverter converter = new JwtGrantedAuthoritiesConverter();
        converter.setAuthoritiesClaimName("roles");
        converter.setAuthorityPrefix("ROLE_");
        this.authoritiesConverter = converter;
    }

    @Override
    public AbstractAuthenticationToken convert(Jwt jwt) {
        Long tenantId = parseTenantIdClaim(jwt);
        Long userId = parseSubject(jwt);

        DirectwerkUserPrincipal principal = new DirectwerkUserPrincipal(
                userId,
                jwt.getClaimAsString("email"),
                null,
                tenantId,
                authoritiesConverter.convert(jwt)
        );

        return new JwtAuthenticationToken(jwt, principal.getAuthorities(), jwt.getSubject()) {
            @Override
            public Object getPrincipal() {
                return principal;
            }
        };
    }

    private static Long parseSubject(Jwt jwt) {
        String subject = jwt.getSubject();
        if (subject == null) {
            return null;
        }
        if (subject.isBlank()) {
            throw new BadJwtException("Invalid subject claim");
        }
        try {
            return Long.valueOf(subject.trim());
        } catch (NumberFormatException ex) {
            // Fail closed as 401 (not 500): only our own RS256-signed tokens reach
            // here, but a non-numeric subject must never become an authenticated
            // principal with a null userId.
            throw new BadJwtException("Invalid subject claim");
        }
    }

    private static Long parseTenantIdClaim(Jwt jwt) {
        Object claim = jwt.getClaim("tenant_id");
        if (claim instanceof Number number) {
            return number.longValue();
        }
        if (claim instanceof String text && !text.isBlank()) {
            try {
                return Long.parseLong(text.trim());
            } catch (NumberFormatException ex) {
                return null;
            }
        }
        return null;
    }
}
