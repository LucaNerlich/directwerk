package de.pnnit.directwerk.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import de.pnnit.directwerk.modules.core.entity.MembershipStatus;
import de.pnnit.directwerk.modules.core.entity.Role;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.entity.TenantDomain;
import de.pnnit.directwerk.modules.core.entity.TenantMembership;
import de.pnnit.directwerk.modules.core.entity.TenantStatus;
import de.pnnit.directwerk.modules.core.entity.User;
import de.pnnit.directwerk.modules.core.repository.TenantDomainRepository;
import de.pnnit.directwerk.modules.core.repository.TenantMembershipRepository;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.core.repository.UserRepository;
import de.pnnit.directwerk.multitenancy.TenantContext;
import java.time.Instant;
import java.util.EnumSet;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Full-stack coverage for deactivating/reactivating a {@code TenantMembership}, through the real
 * servlet filter chain and security config (no mocked layers, real Postgres via Testcontainers,
 * real signed JWTs) - both the platform-admin path
 * ({@code POST /api/v1/platform/tenants/{tenantId}/users/{userId}/deactivate|reactivate}) and the
 * tenant-admin path ({@code POST /api/v1/tenant/users/{userId}/deactivate|reactivate}).
 *
 * <p>The scenario this feature exists for -
 * {@link #deactivatingMembershipImmediatelyBlocksNextRequestOnStillValidJwt()} - confirms a
 * {@code DISABLED} membership rejects the very next tenant-scoped request even with an
 * already-issued, still-unexpired access token: {@code TenantMembershipGuardFilter} re-checks the
 * DB on every request rather than trusting the JWT's role claims for the token's whole lifetime.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
@ActiveProfiles("flyway-validate")
class MembershipDeactivationFullStackIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:19beta2-alpine");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtEncoder jwtEncoder;

    @Autowired
    private TenantRepository tenantRepository;

    @Autowired
    private TenantDomainRepository tenantDomainRepository;

    @Autowired
    private TenantMembershipRepository tenantMembershipRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TransactionTemplate transactionTemplate;

    @DynamicPropertySource
    static void registerSecrets(DynamicPropertyRegistry registry) {
        registry.add("directwerk.security.platform-client-secret", () -> "test-platform-" + UUID.randomUUID());
        registry.add("directwerk.security.tenant-client-secret", () -> "test-tenant-" + UUID.randomUUID());
        registry.add("directwerk.queue.enabled", () -> "false");
        registry.add("spring.quartz.auto-startup", () -> "false");
    }

    @AfterEach
    void clearContext() {
        TenantContext.clear();
    }

    @Test
    void platformAdminDeactivatesAndReactivatesTenantUser() throws Exception {
        TenantFixture tenant = seedTenant("plat-deact");
        MemberFixture editor = seedMember(tenant.tenantId(), Role.EDITOR, MembershipStatus.ACTIVE);
        String platformToken = mintPlatformAdminToken(seedPlainUser("platform-admin"));

        mockMvc.perform(post(
                        "/api/v1/platform/tenants/{tenantId}/users/{userId}/deactivate",
                        tenant.tenantId(), editor.userId())
                        .header("Authorization", "Bearer " + platformToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("DISABLED"));

        mockMvc.perform(post(
                        "/api/v1/platform/tenants/{tenantId}/users/{userId}/reactivate",
                        tenant.tenantId(), editor.userId())
                        .header("Authorization", "Bearer " + platformToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("ACTIVE"));
    }

    @Test
    void platformAdminDeactivationOfMissingMembershipReturnsNotFound() throws Exception {
        TenantFixture tenant = seedTenant("plat-404");
        String platformToken = mintPlatformAdminToken(seedPlainUser("platform-admin-404"));

        mockMvc.perform(post(
                        "/api/v1/platform/tenants/{tenantId}/users/{userId}/deactivate",
                        tenant.tenantId(), 999_999L)
                        .header("Authorization", "Bearer " + platformToken))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.errors[0].code").value("TENANT_MEMBERSHIP_NOT_FOUND"));
    }

    @Test
    void tenantAdminCanDeactivateAndReactivateAnotherMember() throws Exception {
        TenantFixture tenant = seedTenant("tenant-deact");
        MemberFixture admin = seedMember(tenant.tenantId(), Role.TENANT_ADMIN, MembershipStatus.ACTIVE);
        MemberFixture subscriber = seedMember(tenant.tenantId(), Role.SUBSCRIBER, MembershipStatus.ACTIVE);
        String adminToken = mintTenantToken(tenant.tenantId(), admin.userId(), "TENANT_ADMIN");

        mockMvc.perform(post("/api/v1/tenant/users/{userId}/deactivate", subscriber.userId())
                        .with(hostHeader(tenant.host()))
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("DISABLED"));

        mockMvc.perform(post("/api/v1/tenant/users/{userId}/reactivate", subscriber.userId())
                        .with(hostHeader(tenant.host()))
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("ACTIVE"));
    }

    @Test
    void tenantAdminSelfDeactivationIsRejected() throws Exception {
        TenantFixture tenant = seedTenant("tenant-self");
        MemberFixture admin = seedMember(tenant.tenantId(), Role.TENANT_ADMIN, MembershipStatus.ACTIVE);
        // A second active admin so the failure below is unambiguously the self-guard, not the
        // last-admin guard.
        seedMember(tenant.tenantId(), Role.TENANT_ADMIN, MembershipStatus.ACTIVE);
        String adminToken = mintTenantToken(tenant.tenantId(), admin.userId(), "TENANT_ADMIN");

        mockMvc.perform(post("/api/v1/tenant/users/{userId}/deactivate", admin.userId())
                        .with(hostHeader(tenant.host()))
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.errors[0].code").value("CANNOT_DEACTIVATE_SELF"));
    }

    @Test
    void deactivatingLastActiveAdminIsRejected() throws Exception {
        TenantFixture tenant = seedTenant("tenant-last-admin");
        MemberFixture onlyAdmin = seedMember(tenant.tenantId(), Role.TENANT_ADMIN, MembershipStatus.ACTIVE);
        String platformToken = mintPlatformAdminToken(seedPlainUser("platform-admin-last"));

        mockMvc.perform(post(
                        "/api/v1/platform/tenants/{tenantId}/users/{userId}/deactivate",
                        tenant.tenantId(), onlyAdmin.userId())
                        .header("Authorization", "Bearer " + platformToken))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.errors[0].code").value("CANNOT_DEACTIVATE_LAST_ADMIN"));
    }

    @Test
    void deactivatingNonLastAdminSucceeds() throws Exception {
        TenantFixture tenant = seedTenant("tenant-non-last-admin");
        MemberFixture adminA = seedMember(tenant.tenantId(), Role.TENANT_ADMIN, MembershipStatus.ACTIVE);
        seedMember(tenant.tenantId(), Role.TENANT_ADMIN, MembershipStatus.ACTIVE);
        String platformToken = mintPlatformAdminToken(seedPlainUser("platform-admin-non-last"));

        mockMvc.perform(post(
                        "/api/v1/platform/tenants/{tenantId}/users/{userId}/deactivate",
                        tenant.tenantId(), adminA.userId())
                        .header("Authorization", "Bearer " + platformToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("DISABLED"));
    }

    @Test
    void deactivatingNonAdminMemberSucceedsWithNoGuard() throws Exception {
        TenantFixture tenant = seedTenant("tenant-non-admin");
        MemberFixture subscriber = seedMember(tenant.tenantId(), Role.SUBSCRIBER, MembershipStatus.ACTIVE);
        String platformToken = mintPlatformAdminToken(seedPlainUser("platform-admin-non-admin"));

        mockMvc.perform(post(
                        "/api/v1/platform/tenants/{tenantId}/users/{userId}/deactivate",
                        tenant.tenantId(), subscriber.userId())
                        .header("Authorization", "Bearer " + platformToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("DISABLED"));
    }

    @Test
    void deactivatingMembershipImmediatelyBlocksNextRequestOnStillValidJwt() throws Exception {
        TenantFixture tenant = seedTenant("mid-session");
        MemberFixture adminA = seedMember(tenant.tenantId(), Role.TENANT_ADMIN, MembershipStatus.ACTIVE);
        seedMember(tenant.tenantId(), Role.TENANT_ADMIN, MembershipStatus.ACTIVE);
        String adminAToken = mintTenantToken(tenant.tenantId(), adminA.userId(), "TENANT_ADMIN");
        String platformToken = mintPlatformAdminToken(seedPlainUser("platform-admin-mid-session"));

        // adminA's still-unexpired token works before deactivation.
        mockMvc.perform(get("/api/v1/me")
                        .with(hostHeader(tenant.host()))
                        .header("Authorization", "Bearer " + adminAToken))
                .andExpect(status().isOk());

        // Platform admin deactivates adminA out-of-band (a different session entirely).
        mockMvc.perform(post(
                        "/api/v1/platform/tenants/{tenantId}/users/{userId}/deactivate",
                        tenant.tenantId(), adminA.userId())
                        .header("Authorization", "Bearer " + platformToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("DISABLED"));

        // The SAME still-unexpired JWT is now rejected mid-session, because
        // TenantMembershipGuardFilter re-validates ACTIVE membership against the DB on every
        // tenant-scoped request rather than trusting the token's role claims for its whole life.
        mockMvc.perform(get("/api/v1/me")
                        .with(hostHeader(tenant.host()))
                        .header("Authorization", "Bearer " + adminAToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.errors[0].code").value("TENANT_MISMATCH"));
    }

    private TenantFixture seedTenant(String label) {
        String host = label + "-" + suffix() + ".test";
        long[] tenantIdHolder = new long[1];

        transactionTemplate.executeWithoutResult(status -> {
            Tenant tenant = new Tenant();
            tenant.setSlug(label + "-" + suffix());
            tenant.setName(label);
            tenant.setStatus(TenantStatus.ACTIVE);
            tenant = tenantRepository.saveAndFlush(tenant);
            tenantIdHolder[0] = tenant.getId();

            TenantDomain domain = new TenantDomain();
            domain.setTenant(tenant);
            domain.setHost(host);
            domain.setVerified(true);
            domain.setPrimary(true);
            tenantDomainRepository.saveAndFlush(domain);
        });

        return new TenantFixture(host, tenantIdHolder[0]);
    }

    private MemberFixture seedMember(Long tenantId, Role role, MembershipStatus status) {
        long[] userIdHolder = new long[1];

        transactionTemplate.executeWithoutResult(txStatus -> {
            TenantContext.setTenantId(tenantId);
            try {
                User user = new User();
                user.setEmail(role.name().toLowerCase() + "-" + suffix() + "@example.test");
                user = userRepository.saveAndFlush(user);
                userIdHolder[0] = user.getId();

                Tenant tenant = tenantRepository.findById(tenantId).orElseThrow();
                TenantMembership membership = new TenantMembership();
                membership.setUser(user);
                membership.setTenant(tenant);
                membership.setRoles(EnumSet.of(role));
                membership.setStatus(status);
                tenantMembershipRepository.saveAndFlush(membership);
            } finally {
                TenantContext.clear();
            }
        });

        return new MemberFixture(userIdHolder[0]);
    }

    private Long seedPlainUser(String label) {
        long[] userIdHolder = new long[1];
        transactionTemplate.executeWithoutResult(status -> {
            User user = new User();
            user.setEmail(label + "-" + suffix() + "@example.test");
            user = userRepository.saveAndFlush(user);
            userIdHolder[0] = user.getId();
        });
        return userIdHolder[0];
    }

    private String mintTenantToken(long tenantId, long userId, String role) {
        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer("http://localhost:8080")
                .audience(List.of("publish-api"))
                .subject(String.valueOf(userId))
                .issuedAt(now)
                .expiresAt(now.plusSeconds(300))
                .claim("tenant_id", tenantId)
                .claim("roles", List.of(role))
                .claim("email", "user-" + userId + "@example.test")
                .build();
        return encode(claims);
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
        return encode(claims);
    }

    private String encode(JwtClaimsSet claims) {
        Jwt jwt = jwtEncoder.encode(
                JwtEncoderParameters.from(JwsHeader.with(SignatureAlgorithm.RS256).build(), claims));
        return jwt.getTokenValue();
    }

    /**
     * Sets the request's server name directly (rather than relying on MockMvc's URL/Host-header
     * parsing) so {@code TenantContextFilter}'s {@code request.getServerName()} lookup resolves
     * to the seeded tenant's domain deterministically.
     */
    private static RequestPostProcessor hostHeader(String host) {
        return request -> {
            request.setServerName(host);
            request.addHeader("Host", host);
            return request;
        };
    }

    private static String suffix() {
        return UUID.randomUUID().toString().substring(0, 8);
    }

    private record TenantFixture(String host, Long tenantId) {
    }

    private record MemberFixture(Long userId) {
    }
}
