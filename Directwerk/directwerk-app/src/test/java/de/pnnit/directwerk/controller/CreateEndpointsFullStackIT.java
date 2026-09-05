package de.pnnit.directwerk.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import de.pnnit.directwerk.modules.core.entity.MembershipStatus;
import de.pnnit.directwerk.modules.core.entity.Role;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.entity.TenantDomain;
import de.pnnit.directwerk.modules.core.entity.TenantMembership;
import de.pnnit.directwerk.modules.core.entity.TenantModuleActivation;
import de.pnnit.directwerk.modules.core.entity.TenantStatus;
import de.pnnit.directwerk.modules.core.entity.User;
import de.pnnit.directwerk.modules.core.repository.TenantDomainRepository;
import de.pnnit.directwerk.modules.core.repository.TenantMembershipRepository;
import de.pnnit.directwerk.modules.core.repository.TenantModuleActivationRepository;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.core.repository.UserRepository;
import de.pnnit.directwerk.modules.digital.DigitalContentModule;
import de.pnnit.directwerk.modules.podcast.PodcastModule;
import de.pnnit.directwerk.modules.subscription.SubscriptionModule;
import de.pnnit.directwerk.multitenancy.TenantContext;
import java.time.Instant;
import java.util.EnumSet;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
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
 * Full-stack regression coverage for the create endpoints that regressed to a bare Spring Boot
 * 500 (no {@code Response<T>} envelope) instead of a {@code 201 Created}, even for valid input
 * with a fresh, unique slug and all required tenant modules active.
 *
 * <p>Root cause: {@code RequiresModuleAspect}'s pointcut bound the {@code @RequiresModule}
 * annotation via {@code @annotation(requiresModule) || @within(requiresModule)}. Binding a single
 * advice parameter to two disjunct annotation designators is not reliably supported by Spring
 * AOP/AspectJ - for every one of these four endpoints the *service* method carries
 * {@code @RequiresModule} directly while the service *class* does not, and that combination
 * resolved the bound parameter to {@code null}, throwing an unmapped {@link NullPointerException}
 * from inside the aspect before the real handler ever ran. Unlike a unit test that mocks the
 * service layer, this test goes through the real Spring AOP proxies (transaction advice +
 * {@code RequiresModuleAspect} + real Hibernate persistence) via {@link MockMvc}, with the full
 * security filter chain enabled (no {@code addFilters = false}), so it fails the same way the
 * live bug did before the fix, and passes once the aspect resolves the annotation correctly.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
@ActiveProfiles("flyway-validate")
class CreateEndpointsFullStackIT {

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
    private TenantModuleActivationRepository tenantModuleActivationRepository;

    @Autowired
    private TenantMembershipRepository tenantMembershipRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TransactionTemplate transactionTemplate;

    @DynamicPropertySource
    static void registerSecrets(DynamicPropertyRegistry registry) {
        registry.add("directwerk.queue.enabled", () -> "false");
        registry.add("spring.quartz.auto-startup", () -> "false");
    }

    @AfterEach
    void clearContext() {
        TenantContext.clear();
    }

    @Test
    void createFormatSucceedsThroughFullStack() throws Exception {
        Fixture fixture = seedTenantAdmin("formats", PodcastModule.KEY);
        String slug = "fmt-" + suffix();

        mockMvc.perform(post("/api/v1/formats")
                        .with(hostHeader(fixture.host()))
                        .header("Authorization", "Bearer " + fixture.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"slug\":\"%s\",\"name\":\"Debug Format\",\"sortOrder\":1}".formatted(slug)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.slug").value(slug));
    }

    @Test
    void createSubscriptionProductSucceedsThroughFullStack() throws Exception {
        Fixture fixture = seedTenantAdmin("products", SubscriptionModule.MODULE_KEY);
        String slug = "prod-" + suffix();

        mockMvc.perform(post("/api/v1/tenant/products")
                        .with(hostHeader(fixture.host()))
                        .header("Authorization", "Bearer " + fixture.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"slug\":\"%s\",\"title\":\"Debug Product\",\"sortOrder\":1}".formatted(slug)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.slug").value(slug));
    }

    @Test
    void createCategorySucceedsThroughFullStack() throws Exception {
        Fixture fixture = seedTenantAdmin("categories", DigitalContentModule.KEY);
        String slug = "cat-" + suffix();

        mockMvc.perform(post("/api/v1/categories")
                        .with(hostHeader(fixture.host()))
                        .header("Authorization", "Bearer " + fixture.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"slug\":\"%s\",\"name\":\"Debug Category\"}".formatted(slug)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.slug").value(slug));
    }

    @Test
    void createSeriesSucceedsThroughFullStack() throws Exception {
        Fixture fixture = seedTenantAdmin("series", PodcastModule.KEY);
        String slug = "series-" + suffix();

        mockMvc.perform(post("/api/v1/series")
                        .with(hostHeader(fixture.host()))
                        .header("Authorization", "Bearer " + fixture.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"slug\":\"%s\",\"title\":\"Debug Series\"}".formatted(slug)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.slug").value(slug));
    }

    /**
     * Seeds a tenant, an active module activation for {@code moduleKey}, a verified domain, and a
     * tenant-admin user with an active membership - everything the security filter chain and
     * {@code RequiresModuleAspect} require for a real {@code TENANT_ADMIN} request to succeed -
     * then mints a real signed JWT for that user/tenant.
     */
    private Fixture seedTenantAdmin(String label, String moduleKey) {
        String host = label + "-" + suffix() + ".test";
        long[] tenantIdHolder = new long[1];
        long[] userIdHolder = new long[1];

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

            TenantContext.setTenantId(tenant.getId());
            try {
                TenantModuleActivation activation = new TenantModuleActivation();
                activation.setTenant(tenant);
                activation.setModuleKey(moduleKey);
                activation.setActive(true);
                tenantModuleActivationRepository.saveAndFlush(activation);

                User user = new User();
                user.setEmail(label + "-" + suffix() + "@example.test");
                user = userRepository.saveAndFlush(user);
                userIdHolder[0] = user.getId();

                TenantMembership membership = new TenantMembership();
                membership.setUser(user);
                membership.setTenant(tenant);
                membership.setRoles(EnumSet.of(Role.TENANT_ADMIN));
                membership.setStatus(MembershipStatus.ACTIVE);
                tenantMembershipRepository.saveAndFlush(membership);
            } finally {
                TenantContext.clear();
            }
        });

        String token = mintTenantAdminToken(tenantIdHolder[0], userIdHolder[0]);
        return new Fixture(host, token);
    }

    private String mintTenantAdminToken(long tenantId, long userId) {
        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer("http://localhost:8080")
                .audience(List.of("directwerk-api"))
                .subject(String.valueOf(userId))
                .issuedAt(now)
                .expiresAt(now.plusSeconds(300))
                .claim("tenant_id", tenantId)
                .claim("roles", List.of("TENANT_ADMIN"))
                .claim("email", "tenant-admin-" + userId + "@example.test")
                .build();
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

    private record Fixture(String host, String token) {
    }
}
