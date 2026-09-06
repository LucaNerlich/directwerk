package de.pnnit.directwerk.security;

import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.source.ImmutableJWKSet;
import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.proc.SecurityContext;
import de.pnnit.directwerk.api.exception.FilterExceptionResolver;
import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.marketing.ContactFormLimits;
import de.pnnit.directwerk.modules.marketing.ContactRequestBodySizeFilter;
import de.pnnit.directwerk.config.DirectwerkProperties;
import de.pnnit.directwerk.multitenancy.TenantContextFilter;
import de.pnnit.directwerk.multitenancy.TenantResolver;
import de.pnnit.directwerk.multitenancy.BffTenantRoutingHostFilter;
import de.pnnit.directwerk.multitenancy.TenantRoutingHostResolver;
import de.pnnit.directwerk.security.grants.PasswordGrantAuthenticationConverter;
import de.pnnit.directwerk.security.grants.PasswordGrantAuthenticationProvider;
import java.security.KeyPair;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.util.List;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;
import de.pnnit.directwerk.security.grants.PasswordGrantAuthenticationToken;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Token;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationService;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClientRepository;
import org.springframework.security.config.annotation.web.configurers.oauth2.server.authorization.OAuth2AuthorizationServerConfigurer;
import org.springframework.security.oauth2.server.authorization.settings.AuthorizationServerSettings;
import org.springframework.security.oauth2.server.authorization.token.DelegatingOAuth2TokenGenerator;
import org.springframework.security.oauth2.server.authorization.token.JwtGenerator;
import org.springframework.security.oauth2.server.authorization.token.OAuth2AccessTokenGenerator;
import org.springframework.security.oauth2.server.authorization.token.OAuth2RefreshTokenGenerator;
import org.springframework.security.oauth2.server.authorization.token.OAuth2TokenGenerator;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.LoginUrlAuthenticationEntryPoint;
import org.springframework.security.web.util.matcher.MediaTypeRequestMatcher;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    /**
     * Configures security for OAuth2 Authorization Server endpoints, including OIDC and password-grant token issuance.
     *
     * @return the configured authorization server security filter chain
     */
    @Bean
    @Order(1)
    SecurityFilterChain authorizationServerSecurityFilterChain(
            HttpSecurity http,
            UserDetailsService userDetailsService,
            PasswordEncoder passwordEncoder,
            OAuth2AuthorizationService authorizationService,
            OAuth2TokenGenerator<? extends OAuth2Token> tokenGenerator
    ) throws Exception {
        OAuth2AuthorizationServerConfigurer authorizationServerConfigurer =
                new OAuth2AuthorizationServerConfigurer();

        http.securityMatcher(authorizationServerConfigurer.getEndpointsMatcher())
                .with(authorizationServerConfigurer, authorizationServer -> authorizationServer
                        .oidc(Customizer.withDefaults())
                        .tokenEndpoint(tokenEndpoint -> tokenEndpoint
                                .accessTokenRequestConverter(new PasswordGrantAuthenticationConverter())
                                .authenticationProvider(new PasswordGrantAuthenticationProvider(
                                        userDetailsService,
                                        passwordEncoder,
                                        authorizationService,
                                        tokenGenerator
                                ))
                        )
                        // RFC 7009 revocation so BFF logout routes can invalidate
                        // stolen/left-behind refresh tokens server-side.
                        .tokenRevocationEndpoint(Customizer.withDefaults())
                )
                .authorizeHttpRequests(authorize -> authorize.anyRequest().authenticated())
                .csrf(csrf -> csrf.ignoringRequestMatchers(authorizationServerConfigurer.getEndpointsMatcher()))
                .exceptionHandling(exceptions -> exceptions.defaultAuthenticationEntryPointFor(
                        new LoginUrlAuthenticationEntryPoint("/login"),
                        new MediaTypeRequestMatcher(MediaType.TEXT_HTML)
                ));

        return http.build();
    }

    @Bean
    @Order(2)
    SecurityFilterChain apiSecurityFilterChain(
            HttpSecurity http,
            JwtDecoder jwtDecoder,
            TenantContextFilter tenantContextFilter,
            BffTenantRoutingHostFilter bffTenantRoutingHostFilter,
            TenantMembershipGuardFilter tenantMembershipGuardFilter,
            DirectwerkJwtAuthenticationConverter jwtAuthenticationConverter,
            BillingRateLimitFilter billingRateLimitFilter,
            ApiAuthenticationEntryPoint apiAuthenticationEntryPoint,
            ApiAccessDeniedHandler apiAccessDeniedHandler
    ) throws Exception {

        http.securityMatcher("/**")
                .cors(Customizer.withDefaults())
                .csrf(csrf -> csrf.disable())
                .headers(headers -> headers.contentSecurityPolicy(csp -> csp.policyDirectives(
                        "default-src 'self'; "
                                // Swagger UI's static bundle uses only externally-sourced <script>
                                // tags (confirmed: no inline scripts are served), but it does set
                                // inline `style` attributes at runtime, so style-src still needs
                                // 'unsafe-inline'.
                                + "script-src 'self'; "
                                + "style-src 'self' 'unsafe-inline'; "
                                + "img-src 'self' data: https:; "
                                + "font-src 'self' data:; "
                                + "connect-src 'self'"
                )))
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> {
                    for (ApiAuthorizationRule rule : apiAuthorizationRules()) {
                        String[] patterns = rule.patterns().toArray(String[]::new);
                        switch (rule.access()) {
                            case PERMIT_ALL -> auth.requestMatchers(patterns).permitAll();
                            case PLATFORM_ADMIN -> auth.requestMatchers(patterns).hasRole("PLATFORM_ADMIN");
                            case TENANT_ADMIN -> auth.requestMatchers(patterns).hasRole("TENANT_ADMIN");
                            case EDITOR_OR_TENANT_ADMIN ->
                                    auth.requestMatchers(patterns).hasAnyRole("EDITOR", "TENANT_ADMIN");
                            case AUTHENTICATED -> auth.requestMatchers(patterns).authenticated();
                        }
                    }
                    auth.anyRequest().authenticated();
                })
                .oauth2ResourceServer(oauth2 -> oauth2.jwt(jwt -> jwt
                        .decoder(jwtDecoder)
                        .jwtAuthenticationConverter(jwtAuthenticationConverter)
                )
                        // Bearer-token failures (missing/expired/invalid JWT) must use the API's
                        // Response<T> error envelope, not Spring Security's default empty 401/403.
                        .authenticationEntryPoint(apiAuthenticationEntryPoint)
                        .accessDeniedHandler(apiAccessDeniedHandler)
                )
                .exceptionHandling(exceptions -> exceptions
                        .authenticationEntryPoint(apiAuthenticationEntryPoint)
                        .accessDeniedHandler(apiAccessDeniedHandler)
                )
                .addFilterAfter(tenantContextFilter, org.springframework.security.oauth2.server.resource.web.authentication.BearerTokenAuthenticationFilter.class)
                .addFilterBefore(bffTenantRoutingHostFilter, TenantContextFilter.class)
                .addFilterAfter(billingRateLimitFilter, TenantContextFilter.class)
                .addFilterAfter(tenantMembershipGuardFilter, BillingRateLimitFilter.class);

        return http.build();
    }

    /** JWT-layer access level for one ordered matcher row. */
    enum ApiAccess {
        PERMIT_ALL, PLATFORM_ADMIN, TENANT_ADMIN, EDITOR_OR_TENANT_ADMIN, AUTHENTICATED
    }

    /** One ordered row of the API authorization table (first match wins). */
    record ApiAuthorizationRule(ApiAccess access, List<String> patterns) {
    }

    /**
     * The API authorization table, extracted so {@code RequestScopeSecurityConsistencyTest}
     * can pin it against the {@link RequestScope} taxonomy.
     *
     * <p>Content matchers derive from {@link RequestScope#editorContentBases()} and
     * {@link RequestScope#tenantAdminContentBases()} — {@code RequestScope} is the single
     * owner of content path roots. The permitAll block stays a deliberate narrow list
     * (not wholesale {@code PUBLIC} prefixes): actuator exposes only health/info, auth only
     * the anonymous endpoints (login/refresh/logout live behind the authorization-server
     * chain), and {@code /api/v1/webhooks/stripe} is reachable without a JWT because Stripe
     * cannot present one (verified via webhook signature instead).
     */
    static List<ApiAuthorizationRule> apiAuthorizationRules() {
        List<ApiAuthorizationRule> rules = new java.util.ArrayList<>();
        rules.add(new ApiAuthorizationRule(ApiAccess.PERMIT_ALL, List.of(
                "/api/v1/public/**",
                "/feeds/**",
                "/actuator/health",
                "/actuator/info",
                "/swagger-ui/**",
                "/swagger-ui.html",
                "/v3/api-docs/**",
                "/api/v1/auth/register",
                "/api/v1/auth/accept-invite",
                "/api/v1/auth/studio/**",
                "/api/v1/auth/forgot-password",
                "/api/v1/auth/reset-password",
                "/api/v1/auth/verify-email",
                "/api/v1/webhooks/stripe")));
        rules.add(new ApiAuthorizationRule(ApiAccess.PLATFORM_ADMIN, List.of("/api/v1/platform/**")));
        List<String> tenantAdminPatterns = new java.util.ArrayList<>(List.of("/api/v1/tenant/**"));
        tenantAdminPatterns.addAll(RequestScope.antPatterns(RequestScope.tenantAdminContentBases()));
        rules.add(new ApiAuthorizationRule(ApiAccess.TENANT_ADMIN, List.copyOf(tenantAdminPatterns)));
        List<String> editorPatterns =
                new java.util.ArrayList<>(RequestScope.antPatterns(RequestScope.editorContentBases()));
        editorPatterns.add("/api/v1/probes/**");
        rules.add(new ApiAuthorizationRule(ApiAccess.EDITOR_OR_TENANT_ADMIN, List.copyOf(editorPatterns)));
        rules.add(new ApiAuthorizationRule(ApiAccess.AUTHENTICATED,
                List.of("/api/v1/security/**", "/api/v1/me/**")));
        return List.copyOf(rules);
    }

    @Bean
    BillingRateLimitFilter billingRateLimitFilter(DirectwerkConfig directwerkConfig) {
        DirectwerkProperties.Security security = directwerkConfig.security();
        int billingLimit = security.billingRateLimitPerMinute() != null ? security.billingRateLimitPerMinute() : 10;
        if (billingLimit <= 0) {
            throw new IllegalStateException("Billing rate limit must be positive, got: " + billingLimit);
        }
        return new BillingRateLimitFilter(billingLimit, security.trustedProxies());
    }

    @Bean
    OAuth2TokenGenerator<? extends OAuth2Token> tokenGenerator(
            JwtGenerator jwtGenerator
    ) {
        OAuth2AccessTokenGenerator accessTokenGenerator = new OAuth2AccessTokenGenerator();
        OAuth2RefreshTokenGenerator refreshTokenGenerator = new OAuth2RefreshTokenGenerator();
        return new DelegatingOAuth2TokenGenerator(jwtGenerator, accessTokenGenerator, refreshTokenGenerator);
    }

    @Bean
    JwtGenerator jwtGenerator(JwtTenantCustomizer jwtTenantCustomizer, NimbusJwtEncoder jwtEncoder) {
        JwtGenerator jwtGenerator = new JwtGenerator(jwtEncoder);
        jwtGenerator.setJwtCustomizer(jwtTenantCustomizer);
        return jwtGenerator;
    }

    @Bean
    NimbusJwtEncoder jwtEncoder(JWKSource<SecurityContext> jwkSource) {
        return new NimbusJwtEncoder(jwkSource);
    }

    @Bean
    JwtDecoder jwtDecoder(JWKSource<SecurityContext> jwkSource, DirectwerkConfig directwerkConfig) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSource(jwkSource).build();
        OAuth2TokenValidator<Jwt> issuerValidator = JwtValidators.createDefaultWithIssuer(directwerkConfig.security().issuer());
        OAuth2TokenValidator<Jwt> audienceValidator = new AudienceValidator(directwerkConfig.security().audience());
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(issuerValidator, audienceValidator));
        return decoder;
    }

    @Bean
    JWKSource<SecurityContext> jwkSource(DirectwerkConfig directwerkConfig) {
        KeyPair keyPair = JwtKeySupport.resolveKeyPair(
                directwerkConfig.security().jwtPrivateKey(),
                directwerkConfig.security().jwtPublicKey()
        );
        RSAPublicKey publicKey = (RSAPublicKey) keyPair.getPublic();
        RSAPrivateKey privateKey = (RSAPrivateKey) keyPair.getPrivate();
        RSAKey rsaKey = new RSAKey.Builder(publicKey)
                .privateKey(privateKey)
                .keyID(JwtKeySupport.deriveKeyId(publicKey))
                .build();
        return new ImmutableJWKSet<>(new JWKSet(rsaKey));
    }

    @Bean
    AuthorizationServerSettings authorizationServerSettings(DirectwerkConfig directwerkConfig) {
        return AuthorizationServerSettings.builder()
                .issuer(directwerkConfig.security().issuer())
                .build();
    }

    @Bean
    DaoAuthenticationProvider daoAuthenticationProvider(
            UserDetailsService userDetailsService,
            PasswordEncoder passwordEncoder
    ) {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder);
        return provider;
    }

    @Bean
    BffTenantRoutingHostFilter bffTenantRoutingHostFilter(
            TenantRoutingHostResolver tenantRoutingHostResolver
    ) {
        return new BffTenantRoutingHostFilter(tenantRoutingHostResolver);
    }

    @Bean
    FilterRegistrationBean<BffTenantRoutingHostFilter> bffTenantRoutingHostFilterRegistration(
            BffTenantRoutingHostFilter bffTenantRoutingHostFilter
    ) {
        FilterRegistrationBean<BffTenantRoutingHostFilter> registration =
                new FilterRegistrationBean<>(bffTenantRoutingHostFilter);
        // Run after Spring's ForwardedHeaderFilter (also HIGHEST_PRECEDENCE).
        registration.setOrder(Ordered.HIGHEST_PRECEDENCE + 1);
        return registration;
    }

    @Bean
    FilterRegistrationBean<AuthRateLimitFilter> authRateLimitFilterRegistration(DirectwerkConfig directwerkConfig) {
        FilterRegistrationBean<AuthRateLimitFilter> registration = new FilterRegistrationBean<>();
        DirectwerkProperties.Security security = directwerkConfig.security();
        int oauthLimit = security.oauthTokenRateLimitPerMinute() != null ? security.oauthTokenRateLimitPerMinute() : 10;
        int forgotPasswordLimit = security.forgotPasswordRateLimitPerMinute() != null ? security.forgotPasswordRateLimitPerMinute() : 5;
        int authLimit = security.authRateLimitPerMinute() != null ? security.authRateLimitPerMinute() : 20;
        int contactLimit = directwerkConfig.marketing().contact().rateLimitPerMinute();

        if (oauthLimit <= 0) {
            throw new IllegalStateException("OAuth token rate limit must be positive, got: " + oauthLimit);
        }
        if (forgotPasswordLimit <= 0) {
            throw new IllegalStateException("Forgot password rate limit must be positive, got: " + forgotPasswordLimit);
        }
        if (authLimit <= 0) {
            throw new IllegalStateException("Auth rate limit must be positive, got: " + authLimit);
        }
        if (contactLimit <= 0) {
            throw new IllegalStateException("Contact form rate limit must be positive, got: " + contactLimit);
        }

        registration.setFilter(new AuthRateLimitFilter(
                oauthLimit,
                forgotPasswordLimit,
                authLimit,
                contactLimit,
                security.trustedProxies()
        ));
        registration.addUrlPatterns(
                "/oauth2/token",
                "/api/v1/auth/*",
                "/api/v1/public/contact",
                "/api/v1/public/altcha/*"
        );
        registration.setOrder(Ordered.HIGHEST_PRECEDENCE);
        return registration;
    }

    @Bean
    FilterRegistrationBean<ContactRequestBodySizeFilter> contactRequestBodySizeFilterRegistration() {
        FilterRegistrationBean<ContactRequestBodySizeFilter> registration = new FilterRegistrationBean<>();
        registration.setFilter(new ContactRequestBodySizeFilter(ContactFormLimits.MAX_REQUEST_BODY_BYTES));
        registration.addUrlPatterns("/api/v1/public/contact");
        registration.setOrder(Ordered.HIGHEST_PRECEDENCE);
        return registration;
    }

    /**
     * Creates the filter that establishes the tenant context for requests.
     *
     * @param tenantResolver resolves the tenant associated with a request
     * @return the tenant context filter
     */
    @Bean
    TenantContextFilter tenantContextFilter(
            TenantResolver tenantResolver,
            FilterExceptionResolver filterExceptionResolver,
            TenantRoutingHostResolver tenantRoutingHostResolver
    ) {
        return new TenantContextFilter(tenantResolver, filterExceptionResolver, tenantRoutingHostResolver);
    }

    /**
     * Creates a filter that enforces tenant membership for authenticated requests.
     *
     * @param currentTenantMembershipService resolves and validates membership from SecurityContext
     * @param filterExceptionResolver resolves tenant-isolation exceptions into the standard JSON error envelope
     * @return the configured tenant membership guard filter
     */
    @Bean
    TenantMembershipGuardFilter tenantMembershipGuardFilter(
            CurrentTenantMembershipService currentTenantMembershipService,
            FilterExceptionResolver filterExceptionResolver
    ) {
        return new TenantMembershipGuardFilter(currentTenantMembershipService, filterExceptionResolver);
    }

    /**
     * Exposes the configured authentication manager as a Spring bean.
     *
     * @param configuration the authentication configuration
     * @return the configured authentication manager
     * @throws Exception if the authentication manager cannot be obtained
     */
    @Bean
    AuthenticationManager authenticationManager(AuthenticationConfiguration configuration) throws Exception {
        return configuration.getAuthenticationManager();
    }
}
