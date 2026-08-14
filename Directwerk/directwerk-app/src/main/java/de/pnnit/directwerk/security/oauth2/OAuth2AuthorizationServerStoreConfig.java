package de.pnnit.directwerk.security.oauth2;

import de.pnnit.directwerk.security.DirectwerkUserPrincipal;
import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcOperations;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.jackson.SecurityJacksonModules;
import org.springframework.security.oauth2.server.authorization.JdbcOAuth2AuthorizationConsentService;
import org.springframework.security.oauth2.server.authorization.JdbcOAuth2AuthorizationService;
import org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationConsentService;
import org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationService;
import org.springframework.security.oauth2.server.authorization.client.JdbcRegisteredClientRepository;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClientRepository;
import tools.jackson.databind.JacksonModule;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.jsontype.BasicPolymorphicTypeValidator;

@Configuration
@ConditionalOnProperty(prefix = "directwerk.security", name = "authorization-store", havingValue = "jdbc", matchIfMissing = true)
public class OAuth2AuthorizationServerStoreConfig {

    @Bean
    RegisteredClientRepository registeredClientRepository(JdbcOperations jdbcOperations) {
        return new JdbcRegisteredClientRepository(jdbcOperations);
    }

    // OAuth2Authorization persists the saved Authentication (including its DirectwerkUserPrincipal
    // principal, see PasswordGrantAuthenticationProvider) as polymorphic JSON. Spring Security's
    // default modules only trust its own types, so DirectwerkUserPrincipal must be added to the
    // PolymorphicTypeValidator explicitly or deserialization is rejected on every token lookup.
    //
    // JWT claim values under metadata.token.claims are also typed. Spring Security's CoreJacksonModule
    // allowlists specific collection *names* (ArrayList, Collections$Unmodifiable*, …) but not
    // List.of/Set.of → java.util.ImmutableCollections$ListN/SetN. Allow those by name prefix (same
    // pattern Spring uses), plus Number for tenant_id Long/Integer.
    private static JsonMapper authorizationJsonMapper() {
        BasicPolymorphicTypeValidator.Builder polymorphicTypeValidatorBuilder = BasicPolymorphicTypeValidator.builder()
                .allowIfSubType(DirectwerkUserPrincipal.class)
                .allowIfSubType(Number.class)
                .allowIfSubType(java.net.URL.class)
                .allowIfSubType("java.util.ImmutableCollections");
        List<JacksonModule> modules = SecurityJacksonModules.getModules(
                OAuth2AuthorizationServerStoreConfig.class.getClassLoader(),
                polymorphicTypeValidatorBuilder
        );
        return JsonMapper.builder().addModules(modules).build();
    }

    @Bean
    OAuth2AuthorizationService authorizationService(
            JdbcOperations jdbcOperations,
            RegisteredClientRepository registeredClientRepository,
            UserDetailsService userDetailsService
    ) {
        JdbcOAuth2AuthorizationService delegate =
                new JdbcOAuth2AuthorizationService(jdbcOperations, registeredClientRepository);
        JsonMapper jsonMapper = authorizationJsonMapper();
        delegate.setAuthorizationRowMapper(new JdbcOAuth2AuthorizationService.JsonMapperOAuth2AuthorizationRowMapper(
                registeredClientRepository,
                jsonMapper
        ));
        delegate.setAuthorizationParametersMapper(
                new JdbcOAuth2AuthorizationService.JsonMapperOAuth2AuthorizationParametersMapper(jsonMapper)
        );
        return new StateValidatingOAuth2AuthorizationService(delegate, userDetailsService);
    }

    @Bean
    OAuth2AuthorizationConsentService authorizationConsentService(
            JdbcOperations jdbcOperations,
            RegisteredClientRepository registeredClientRepository
    ) {
        return new JdbcOAuth2AuthorizationConsentService(jdbcOperations, registeredClientRepository);
    }
}
