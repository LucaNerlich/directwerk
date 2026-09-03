package de.pnnit.directwerk.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.security.oauth2.jwt.Jwt;

class DirectwerkJwtAuthenticationConverterTest {

    private final DirectwerkJwtAuthenticationConverter converter =
            new DirectwerkJwtAuthenticationConverter();

    @Test
    void convertsNumericSubjectAndTenantClaim() {
        Jwt jwt = jwt(Map.of(
                "sub", "42",
                "email", "editor@example.com",
                "roles", List.of("EDITOR"),
                "tenant_id", 7L
        ));

        AbstractAuthenticationToken token = converter.convert(jwt);

        assertThat(token.getPrincipal()).isInstanceOf(DirectwerkUserPrincipal.class);
        DirectwerkUserPrincipal principal = (DirectwerkUserPrincipal) token.getPrincipal();
        assertThat(principal.userId()).isEqualTo(42L);
        assertThat(principal.tenantId()).isEqualTo(7L);
        assertThat(principal.getAuthorities())
                .extracting(Object::toString)
                .containsExactly("ROLE_EDITOR");
    }

    @Test
    void rejectsNonNumericSubjectInsteadOfThrowingServerError() {
        // Regression: Long.parseLong on the subject threw NumberFormatException
        // (500). A malformed subject must fail closed as 401 via BadJwtException.
        Jwt jwt = jwt(Map.of(
                "sub", "not-a-number",
                "email", "editor@example.com",
                "roles", List.of("EDITOR"),
                "tenant_id", 7L
        ));

        assertThatThrownBy(() -> converter.convert(jwt))
                .isInstanceOf(BadJwtException.class);
    }

    private static Jwt jwt(Map<String, Object> claims) {
        return new Jwt(
                "token",
                Instant.now().minusSeconds(60),
                Instant.now().plusSeconds(60),
                Map.of("alg", "RS256"),
                claims
        );
    }
}
