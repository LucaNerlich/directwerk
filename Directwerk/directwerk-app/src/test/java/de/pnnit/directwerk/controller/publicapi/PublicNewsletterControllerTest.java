package de.pnnit.directwerk.controller.publicapi;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.newsletter.exception.NewsletterSubscriptionNotFoundException;
import de.pnnit.directwerk.modules.newsletter.service.NewsletterListService;
import de.pnnit.directwerk.modules.newsletter.service.NewsletterSubscriptionService;
import de.pnnit.directwerk.multitenancy.TenantContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

/**
 * Issue #390: the compliance-critical double opt-in flow (subscribe -> confirm -> unsubscribe)
 * had no HTTP-level coverage, so the status codes the frontends depend on could regress unnoticed.
 */
@ExtendWith(MockitoExtension.class)
class PublicNewsletterControllerTest {

    @Mock
    private NewsletterListService newsletterListService;

    @Mock
    private NewsletterSubscriptionService newsletterSubscriptionService;

    private PublicNewsletterController controller;

    @BeforeEach
    void setUp() {
        controller = new PublicNewsletterController(newsletterListService, newsletterSubscriptionService);
        TenantContext.setTenantId(10L);
    }

    @AfterEach
    void clear() {
        TenantContext.clear();
    }

    @Test
    void subscribeIsAcceptedAndDelegatesWithTheResolvedTenant() {
        ResponseEntity<?> response = controller.subscribe(
                "weekly",
                new PublicNewsletterController.SubscribeRequest("reader@example.com"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.ACCEPTED);
        verify(newsletterSubscriptionService).requestSubscribe(10L, "weekly", "reader@example.com");
    }

    @Test
    void confirmDelegatesTheTokenAndReturnsOk() {
        ResponseEntity<?> response =
                controller.confirm(new PublicNewsletterController.TokenRequest("confirm-token"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        verify(newsletterSubscriptionService).confirm("confirm-token");
    }

    @Test
    void unsubscribeDelegatesTheTokenAndReturnsOk() {
        ResponseEntity<?> response =
                controller.unsubscribe(new PublicNewsletterController.TokenRequest("unsub-token"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        verify(newsletterSubscriptionService).unsubscribe("unsub-token");
    }

    @Test
    void unknownOrExpiredTokenSurfacesAsSubscriptionNotFound() {
        when(newsletterSubscriptionService.confirm("expired"))
                .thenThrow(new NewsletterSubscriptionNotFoundException("Invalid confirm token"));

        assertThatThrownBy(() ->
                controller.confirm(new PublicNewsletterController.TokenRequest("expired")))
                .isInstanceOf(NewsletterSubscriptionNotFoundException.class);
    }

    @Test
    void unsubscribeWithUnknownTokenSurfacesAsSubscriptionNotFound() {
        when(newsletterSubscriptionService.unsubscribe("expired"))
                .thenThrow(new NewsletterSubscriptionNotFoundException("Invalid unsubscribe token"));

        assertThatThrownBy(() ->
                controller.unsubscribe(new PublicNewsletterController.TokenRequest("expired")))
                .isInstanceOf(NewsletterSubscriptionNotFoundException.class);
    }
}
