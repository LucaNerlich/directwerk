package de.pnnit.directwerk.security.oauth2;

import de.pnnit.directwerk.config.DirectwerkConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClientRepository;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
@ConditionalOnProperty(prefix = "directwerk.security", name = "authorization-store", havingValue = "jdbc", matchIfMissing = true)
public class OAuth2RegisteredClientBootstrap implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(OAuth2RegisteredClientBootstrap.class);

    private final RegisteredClientRepository registeredClientRepository;
    private final OAuth2RegisteredClientFactory registeredClientFactory;
    private final DirectwerkConfig directwerkConfig;
    private final PasswordEncoder passwordEncoder;

    public OAuth2RegisteredClientBootstrap(
            RegisteredClientRepository registeredClientRepository,
            OAuth2RegisteredClientFactory registeredClientFactory,
            DirectwerkConfig directwerkConfig,
            PasswordEncoder passwordEncoder
    ) {
        this.registeredClientRepository = registeredClientRepository;
        this.registeredClientFactory = registeredClientFactory;
        this.directwerkConfig = directwerkConfig;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(ApplicationArguments args) {
        requireConfiguredSecret(directwerkConfig.security().tenantClientSecret(), "tenant");
        requireConfiguredSecret(directwerkConfig.security().platformClientSecret(), "platform");
        syncClient(registeredClientFactory.buildTenantClient(directwerkConfig, passwordEncoder));
        syncClient(registeredClientFactory.buildPlatformClient(directwerkConfig, passwordEncoder));
    }

    private static void requireConfiguredSecret(String secret, String clientName) {
        if (!StringUtils.hasText(secret)) {
            throw new IllegalStateException("OAuth2 client secret must be configured for " + clientName + " client");
        }
    }

    private void syncClient(RegisteredClient client) {
        try {
            RegisteredClient existing = registeredClientRepository.findByClientId(client.getClientId());
            if (existing == null) {
                registeredClientRepository.save(client);
                log.info("Registered OAuth2 client {}", client.getClientId());
                return;
            }
            registeredClientRepository.save(
                    RegisteredClient.from(client).id(existing.getId()).build()
            );
            log.debug("Synchronized OAuth2 client {}", client.getClientId());
        } catch (Exception e) {
            // Handle race condition: another replica may have inserted the client concurrently
            // Re-read and update with the stored ID
            RegisteredClient existing = registeredClientRepository.findByClientId(client.getClientId());
            if (existing != null) {
                registeredClientRepository.save(
                        RegisteredClient.from(client).id(existing.getId()).build()
                );
                log.debug("Synchronized OAuth2 client {} after concurrent insert", client.getClientId());
            } else {
                throw e;
            }
        }
    }
}
