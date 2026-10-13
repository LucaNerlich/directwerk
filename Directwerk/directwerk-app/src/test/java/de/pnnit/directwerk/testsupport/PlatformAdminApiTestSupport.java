package de.pnnit.directwerk.testsupport;

import de.pnnit.directwerk.modules.core.entity.PlatformAdmin;
import de.pnnit.directwerk.modules.core.entity.User;
import de.pnnit.directwerk.modules.core.entity.UserStatus;
import de.pnnit.directwerk.modules.core.repository.PlatformAdminRepository;
import de.pnnit.directwerk.modules.core.repository.UserRepository;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/**
 * Base class for MockMvc tests of the platform-admin surface ({@code /api/v1/platform/**}).
 *
 * <p>{@code PlatformAdminGuardFilter} re-checks every authenticated platform request against the
 * DB, and {@code SecurityUtils.requirePrincipal()} only accepts a real
 * {@link de.pnnit.directwerk.security.DirectwerkUserPrincipal}. A {@code @WithMockUser} principal
 * satisfies neither, so those requests are rejected with {@code 403} before reaching the
 * controller. These tests therefore authenticate exactly like production does: they seed an ACTIVE
 * platform admin (user + {@code platform_admins} row) and send a signed JWT for that user.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public abstract class PlatformAdminApiTestSupport {

    @Autowired
    protected MockMvc mockMvc;

    @Autowired
    protected JwtEncoder jwtEncoder;

    @Autowired
    protected UserRepository userRepository;

    @Autowired
    protected PlatformAdminRepository platformAdminRepository;

    /** Bearer token for the platform admin seeded by {@link #authenticatePlatformAdmin()}. */
    protected String platformAdminToken;

    @BeforeEach
    protected void authenticatePlatformAdmin() {
        platformAdminToken = mintPlatformAdminToken(seedPlatformAdmin("platform-admin"));
    }

    /** Seeds an ACTIVE platform admin (user + {@code platform_admins} row); returns the user id. */
    protected long seedPlatformAdmin(String label) {
        User user = seedUser(label);
        PlatformAdmin admin = new PlatformAdmin();
        admin.setUser(user);
        platformAdminRepository.save(admin);
        return user.getId();
    }

    /** Seeds an ACTIVE user with no platform-admin grant. */
    protected User seedUser(String label) {
        User user = new User();
        user.setEmail(label + "-" + UUID.randomUUID() + "@example.test");
        user.setStatus(UserStatus.ACTIVE);
        return userRepository.save(user);
    }

    protected String mintPlatformAdminToken(long userId) {
        return mintToken(jwtEncoder, userId, null, List.of("PLATFORM_ADMIN"));
    }

    protected String mintToken(long userId, Long tenantId, List<String> roles) {
        return mintToken(jwtEncoder, userId, tenantId, roles);
    }

    /** Mints an RS256 access token accepted by the resource-server chain. */
    protected static String mintToken(
            JwtEncoder jwtEncoder, long userId, Long tenantId, List<String> roles) {
        Instant now = Instant.now();
        JwtClaimsSet.Builder claims = JwtClaimsSet.builder()
                .issuer("http://localhost:8080")
                .audience(List.of("directwerk-api"))
                .subject(String.valueOf(userId))
                .issuedAt(now)
                .expiresAt(now.plusSeconds(300))
                .claim("roles", roles)
                .claim("email", "user-" + userId + "@example.test");
        if (tenantId != null) {
            claims.claim("tenant_id", tenantId);
        }
        return jwtEncoder.encode(JwtEncoderParameters.from(
                JwsHeader.with(SignatureAlgorithm.RS256).build(), claims.build())).getTokenValue();
    }

    /** Adds the seeded platform admin's bearer token to a request. */
    protected RequestPostProcessor asPlatformAdmin() {
        return bearer(platformAdminToken);
    }

    protected static RequestPostProcessor bearer(String token) {
        return request -> {
            request.addHeader("Authorization", "Bearer " + token);
            return request;
        };
    }
}
