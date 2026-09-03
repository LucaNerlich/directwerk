package de.pnnit.directwerk.config;

import java.util.List;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.StringUtils;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
public class MarketingCorsConfig {

    @Bean
    CorsConfigurationSource corsConfigurationSource(DirectwerkConfig directwerkConfig) {
        CorsConfiguration configuration = new CorsConfiguration();
        List<String> allowedOrigins = directwerkConfig.marketing().contact().allowedOrigins().stream()
                .filter(StringUtils::hasText)
                .map(String::trim)
                .toList();
        configuration.setAllowedOrigins(allowedOrigins);
        configuration.setAllowedMethods(List.of("GET", "POST", "OPTIONS"));
        // Contact/Altcha clients only send JSON: no wildcard, no credentials.
        configuration.setAllowedHeaders(List.of("Content-Type", "Accept"));
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/v1/public/altcha/**", configuration);
        source.registerCorsConfiguration("/api/v1/public/contact", configuration);
        return source;
    }
}
