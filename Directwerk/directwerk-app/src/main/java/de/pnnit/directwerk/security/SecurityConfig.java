package de.pnnit.directwerk.security;

import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.source.ImmutableJWKSet;
import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.proc.SecurityContext;
import de.pnnit.directwerk.api.exception.FilterExceptionResolver;
import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import de.pnnit.directwerk.multitenancy.TenantContextFilter;
import de.pnnit.directwerk.multitenancy.TenantResolver;
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

    /**
     * Configures stateless JWT-based security for application endpoints, including access rules and tenant filters.
     *
     * @param jwtDecoder                 decoder used to validate bearer tokens
     * @param tenantContextFilter        filter that establishes tenant context after bearer-token authentication
     * @param tenantMembershipGuardFilter filter that verifies tenant membership
     * @param jwtAuthenticationConverter converter that maps JWT claims to authenticated authorities
     * @return the configured security filter chain
     */
    @Bean
    @Order(2)
    SecurityFilterChain apiSecurityFilterChain(
            HttpSecurity http,
            JwtDecoder jwtDecoder,
            TenantContextFilter tenantContextFilter,
            TenantMembershipGuardFilter tenantMembershipGuardFilter,
            DirectwerkJwtAuthenticationConverter jwtAuthenticationConverter
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
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(
                                "/api/v1/public/**",
                                "/feeds/**",
                                "/actuator/health",
                                "/actuator/info",
                                "/swagger-ui/**",
                                "/swagger-ui.html",
                                "/v3/api-docs/**",
                                "/api/v1/auth/register",
                                "/api/v1/auth/accept-invite",
                                "/api/v1/auth/forgot-password",
                                "/api/v1/auth/reset-password",
                                "/api/v1/auth/verify-email",
                                "/api/v1/webhooks/stripe"
                        ).permitAll()
                        .requestMatchers("/api/v1/platform/**").hasRole("PLATFORM_ADMIN")
                        .requestMatchers("/api/v1/tenant/**").hasRole("TENANT_ADMIN")
                        .requestMatchers("/api/v1/media/**").hasAnyRole("EDITOR", "TENANT_ADMIN")
                        .requestMatchers("/api/v1/series/**", "/api/v1/episodes/**")
                        .hasAnyRole("EDITOR", "TENANT_ADMIN")
                        .requestMatchers("/api/v1/formats/**", "/api/v1/categories/**").hasRole("TENANT_ADMIN")
                        .requestMatchers("/api/v1/probes/**").hasAnyRole("EDITOR", "TENANT_ADMIN")
                        .requestMatchers("/api/v1/security/**").authenticated()
                        .requestMatchers("/api/v1/me/**").authenticated()
                        .anyRequest().authenticated()
                )
                .oauth2ResourceServer(oauth2 -> oauth2.jwt(jwt -> jwt
                        .decoder(jwtDecoder)
                        .jwtAuthenticationConverter(jwtAuthenticationConverter)
                ))
                .addFilterAfter(tenantContextFilter, org.springframework.security.oauth2.server.resource.web.authentication.BearerTokenAuthenticationFilter.class)
                .addFilterAfter(tenantMembershipGuardFilter, TenantContextFilter.class);

        return http.build();
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
        registration.addUrlPatterns("/oauth2/token", "/api/v1/auth/*", "/api/v1/me/billing/*");
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
            FilterExceptionResolver filterExceptionResolver
    ) {
        return new TenantContextFilter(tenantResolver, filterExceptionResolver);
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
