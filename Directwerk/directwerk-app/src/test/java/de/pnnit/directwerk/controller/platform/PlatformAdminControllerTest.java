package de.pnnit.directwerk.controller.platform;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import de.pnnit.directwerk.modules.core.entity.PlatformAdmin;
import de.pnnit.directwerk.modules.core.entity.User;
import de.pnnit.directwerk.modules.core.entity.UserStatus;
import de.pnnit.directwerk.modules.core.repository.PlatformAdminRepository;
import de.pnnit.directwerk.modules.core.repository.UserRepository;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PlatformAdminControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PlatformAdminRepository platformAdminRepository;

    @Autowired
    private JwtEncoder jwtEncoder;

    private Long firstAdminUserId;
    private Long secondAdminUserId;

    @DynamicPropertySource
    static void registerEphemeralSecrets(DynamicPropertyRegistry registry) {
        String platformClientSecret = "test-platform-" + UUID.randomUUID();
        String tenantClientSecret = "test-tenant-" + UUID.randomUUID();
        registry.add("directwerk.security.platform-client-secret", () -> platformClientSecret);
        registry.add("directwerk.security.tenant-client-secret", () -> tenantClientSecret);
    }

    @BeforeEach
    void seedAdmins() {
        // Isolate each test from admins left behind by previous tests in this shared-context class
        // (the H2 schema is create-drop per Spring context, not per test method), so count-based
        // assertions (e.g. "only one admin remains") are deterministic.
        platformAdminRepository.deleteAll();
        firstAdminUserId = createAdmin("first-admin-" + UUID.randomUUID() + "@example.com", "First Admin");
        secondAdminUserId = createAdmin("second-admin-" + UUID.randomUUID() + "@example.com", "Second Admin");
    }

    private Long createAdmin(String email, String name) {
        User user = new User();
        user.setEmail(email);
        user.setName(name);
        user.setStatus(UserStatus.ACTIVE);
        user = userRepository.save(user);

        PlatformAdmin admin = new PlatformAdmin();
        admin.setUser(user);
        platformAdminRepository.save(admin);

        return user.getId();
    }

    @Test
    @WithMockUser(roles = "PLATFORM_ADMIN")
    void revokeAdminReturnsRevokedAdmin() throws Exception {
        mockMvc.perform(delete("/api/v1/platform/admins/{userId}", secondAdminUserId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.userId").value(secondAdminUserId));
    }

    @Test
    @WithMockUser(roles = "PLATFORM_ADMIN")
    void revokeAdminReturnsConflictWhenOnlyOneAdminRemains() throws Exception {
        mockMvc.perform(delete("/api/v1/platform/admins/{userId}", secondAdminUserId))
                .andExpect(status().isOk());

        mockMvc.perform(delete("/api/v1/platform/admins/{userId}", firstAdminUserId))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.errors[0].code").value("CANNOT_REVOKE_LAST_ADMIN"));
    }

    @Test
    @WithMockUser(roles = "PLATFORM_ADMIN")
    void revokeAdminReturnsNotFoundForUnknownUser() throws Exception {
        mockMvc.perform(delete("/api/v1/platform/admins/{userId}", 999_999L))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.errors[0].code").value("PLATFORM_ADMIN_NOT_FOUND"));
    }

    @Test
    @WithMockUser(roles = "TENANT_ADMIN")
    void revokeAdminRejectsNonPlatformUser() throws Exception {
        mockMvc.perform(delete("/api/v1/platform/admins/{userId}", secondAdminUserId))
                .andExpect(status().isForbidden());
    }

    @Test
    void revokeAdminRejectsAnonymous() throws Exception {
        mockMvc.perform(delete("/api/v1/platform/admins/{userId}", secondAdminUserId))
                .andExpect(status().isUnauthorized());
    }

    // Unlike the tests above, this one mints a real signed JWT (through the real Spring Security
    // filter chain) rather than using @WithMockUser, so SecurityUtils.currentUserId() resolves to
    // an actual, controllable value - required to exercise the self-revoke branch in
    // PlatformAdminManagementService#revokeAdmin, which reads the caller's id from the security
    // context rather than from the request body/path.
    @Test
    void revokeAdminRejectsSelfRevocation() throws Exception {
        String selfToken = mintPlatformAdminToken(firstAdminUserId);

        mockMvc.perform(delete("/api/v1/platform/admins/{userId}", firstAdminUserId)
                        .header("Authorization", "Bearer " + selfToken))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.errors[0].code").value("CANNOT_REVOKE_SELF"));
    }

    private String mintPlatformAdminToken(long userId) {
        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer("http://localhost:8080")
                .audience(List.of("publish-api"))
                .subject(String.valueOf(userId))
                .issuedAt(now)
                .expiresAt(now.plusSeconds(300))
                .claim("roles", List.of("PLATFORM_ADMIN"))
                .claim("email", "platform-admin-" + userId + "@example.test")
                .build();
        Jwt jwt = jwtEncoder.encode(
                JwtEncoderParameters.from(JwsHeader.with(SignatureAlgorithm.RS256).build(), claims));
        return jwt.getTokenValue();
    }
}
