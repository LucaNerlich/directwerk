package de.pnnit.directwerk.security;

import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
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
        Long tenantId = jwt.getClaim("tenant_id") != null
                ? jwt.getClaim("tenant_id") instanceof Number number ? number.longValue() : null
                : null;
        Long userId = jwt.getSubject() != null ? Long.parseLong(jwt.getSubject()) : null;

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
}
