package de.pnnit.directwerk.security.oauth2;

import de.pnnit.directwerk.config.DirectwerkConfig;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.server.authorization.InMemoryOAuth2AuthorizationService;
import org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationService;
import org.springframework.security.oauth2.server.authorization.client.InMemoryRegisteredClientRepository;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClientRepository;

@Configuration
@ConditionalOnProperty(prefix = "directwerk.security", name = "authorization-store", havingValue = "memory")
public class OAuth2AuthorizationServerMemoryStoreConfig {

    @Bean
    RegisteredClientRepository registeredClientRepository(
            DirectwerkConfig directwerkConfig,
            PasswordEncoder passwordEncoder,
            OAuth2RegisteredClientFactory registeredClientFactory
    ) {
        RegisteredClient tenantClient = registeredClientFactory.buildTenantClient(directwerkConfig, passwordEncoder);
        RegisteredClient platformClient = registeredClientFactory.buildPlatformClient(directwerkConfig, passwordEncoder);
        return new InMemoryRegisteredClientRepository(tenantClient, platformClient);
    }

    @Bean
    OAuth2AuthorizationService authorizationService(UserDetailsService userDetailsService) {
        return new StateValidatingOAuth2AuthorizationService(
                new InMemoryOAuth2AuthorizationService(),
                userDetailsService
        );
    }
}
