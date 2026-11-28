package de.pnnit.directwerk.bootstrap;

import de.pnnit.directwerk.config.DirectwerkProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import de.pnnit.directwerk.modules.stripebilling.StripeProperties;
import de.pnnit.directwerk.multitenancy.TenantContextFilter;
import de.pnnit.directwerk.security.BillingRateLimitFilter;
import de.pnnit.directwerk.security.PlatformAdminGuardFilter;
import de.pnnit.directwerk.security.TenantApiKeyAuthenticationFilter;
import de.pnnit.directwerk.security.TenantMembershipGuardFilter;
import java.time.Clock;

@Configuration
@EnableConfigurationProperties({DirectwerkProperties.class, StripeProperties.class})
public class ApplicationConfig {

    /**
     * Creates the password encoder used by the application.
     *
     * @return a BCrypt password encoder configured with strength 12
     */
    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    /**
     * Provides a UTC-based system clock.
     *
     * @return the UTC system clock
     */
    @Bean
    Clock clock() {
        return Clock.systemUTC();
    }

    /**
     * Disables automatic registration of the tenant context filter.
     *
     * @return the disabled tenant context filter registration
     */
    @Bean
    FilterRegistrationBean<TenantContextFilter> disableTenantContextFilterAutoRegistration(
            TenantContextFilter tenantContextFilter
    ) {
        FilterRegistrationBean<TenantContextFilter> registration = new FilterRegistrationBean<>(tenantContextFilter);
        registration.setEnabled(false);
        return registration;
    }

    /**
     * Disables automatic registration of the tenant membership guard filter.
     *
     * @param tenantMembershipGuardFilter the tenant membership guard filter to register
     * @return a disabled filter registration for the specified filter
     */
    @Bean
    FilterRegistrationBean<TenantMembershipGuardFilter> disableTenantMembershipGuardAutoRegistration(
            TenantMembershipGuardFilter tenantMembershipGuardFilter
    ) {
        FilterRegistrationBean<TenantMembershipGuardFilter> registration =
                new FilterRegistrationBean<>(tenantMembershipGuardFilter);
        registration.setEnabled(false);
        return registration;
    }

    /**
     * Disables automatic registration of the billing rate-limit filter; it runs inside the
     * security chain only. Without this Spring Boot also registers it as a servlet filter, so
     * every billing request is counted twice.
     */
    @Bean
    FilterRegistrationBean<BillingRateLimitFilter> disableBillingRateLimitFilterAutoRegistration(
            BillingRateLimitFilter billingRateLimitFilter
    ) {
        FilterRegistrationBean<BillingRateLimitFilter> registration =
                new FilterRegistrationBean<>(billingRateLimitFilter);
        registration.setEnabled(false);
        return registration;
    }

    /**
     * Disables automatic registration of the tenant API-key filter; it runs inside the security
     * chain only, so a second servlet-filter pass cannot re-authenticate or re-write the key.
     */
    @Bean
    FilterRegistrationBean<TenantApiKeyAuthenticationFilter> disableTenantApiKeyFilterAutoRegistration(
            TenantApiKeyAuthenticationFilter tenantApiKeyAuthenticationFilter
    ) {
        FilterRegistrationBean<TenantApiKeyAuthenticationFilter> registration =
                new FilterRegistrationBean<>(tenantApiKeyAuthenticationFilter);
        registration.setEnabled(false);
        return registration;
    }

    /**
     * Disables automatic registration of the platform-admin guard; it runs inside the security
     * chain only.
     */
    @Bean
    FilterRegistrationBean<PlatformAdminGuardFilter> disablePlatformAdminGuardAutoRegistration(
            PlatformAdminGuardFilter platformAdminGuardFilter
    ) {
        FilterRegistrationBean<PlatformAdminGuardFilter> registration =
                new FilterRegistrationBean<>(platformAdminGuardFilter);
        registration.setEnabled(false);
        return registration;
    }
}
