package de.pnnit.directwerk.controller.publicapi;

import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.modules.newsletter.service.NewsletterSubscriptionService;
import de.pnnit.directwerk.multitenancy.TenantContext;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/public")
public class PublicNewsletterController {

    private final NewsletterSubscriptionService newsletterSubscriptionService;

    public PublicNewsletterController(NewsletterSubscriptionService newsletterSubscriptionService) {
        this.newsletterSubscriptionService = newsletterSubscriptionService;
    }

    @PostMapping("/newsletter-lists/{slug}/subscribe")
    ResponseEntity<Response<Void>> subscribe(
            @PathVariable String slug,
            @Valid @RequestBody SubscribeRequest request
    ) {
        Long tenantId = TenantContext.requireTenantId();
        newsletterSubscriptionService.requestSubscribe(tenantId, slug, request.email());
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(Response.accepted(null));
    }

    @PostMapping("/newsletter/confirm")
    ResponseEntity<Response<Void>> confirm(@Valid @RequestBody TokenRequest request) {
        newsletterSubscriptionService.confirm(request.token());
        return ResponseEntity.ok(Response.ok(null));
    }

    @PostMapping("/newsletter/unsubscribe")
    ResponseEntity<Response<Void>> unsubscribe(@Valid @RequestBody TokenRequest request) {
        newsletterSubscriptionService.unsubscribe(request.token());
        return ResponseEntity.ok(Response.ok(null));
    }

    public record SubscribeRequest(@NotBlank @Email String email) {
    }

    public record TokenRequest(@NotBlank String token) {
    }
}
