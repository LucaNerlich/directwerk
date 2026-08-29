package de.pnnit.directwerk.controller.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.controller.auth.MeBillingController.CheckoutSessionView;
import de.pnnit.directwerk.modules.stripebilling.StripeCheckoutService;
import de.pnnit.directwerk.modules.stripebilling.StripeCustomerPortalService;
import de.pnnit.directwerk.security.DirectwerkUserPrincipal;
import de.pnnit.directwerk.security.RoleConstants;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

@ExtendWith(MockitoExtension.class)
class MeBillingControllerTest {

    @Mock
    private StripeCheckoutService stripeCheckoutService;

    @Mock
    private StripeCustomerPortalService stripeCustomerPortalService;

    private MeBillingController controller;

    @BeforeEach
    void setUp() {
        controller = new MeBillingController(stripeCheckoutService, stripeCustomerPortalService);
    }

    @Test
    void createCheckoutSessionReturnsHostedUrl() {
        DirectwerkUserPrincipal principal = principal();
        when(stripeCheckoutService.createCheckoutSession(5L, 1L, "supporter", null, null))
                .thenReturn("https://checkout.stripe.com/c/pay/cs_test");

        ResponseEntity<Response<CheckoutSessionView>> response = controller.createCheckoutSession(
                principal,
                new MeBillingController.CheckoutSessionRequest("supporter", null, null)
        );

        assertThat(response.getStatusCode().value()).isEqualTo(201);
        assertThat(response.getBody().data().url()).isEqualTo("https://checkout.stripe.com/c/pay/cs_test");
    }

    private static DirectwerkUserPrincipal principal() {
        return new DirectwerkUserPrincipal(
                1L,
                "member@example.com",
                "hash",
                5L,
                List.of(new SimpleGrantedAuthority(RoleConstants.SUBSCRIBER))
        );
    }
}
