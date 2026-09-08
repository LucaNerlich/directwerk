package de.pnnit.directwerk.controller.publicapi;

import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.modules.newsletter.entity.NewsletterList;
import de.pnnit.directwerk.modules.newsletter.entity.NewsletterListStatus;
import de.pnnit.directwerk.modules.newsletter.service.NewsletterListService;
import de.pnnit.directwerk.modules.newsletter.service.NewsletterSubscriptionService;
import de.pnnit.directwerk.multitenancy.TenantContext;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/public")
public class PublicNewsletterController {

    private final NewsletterListService newsletterListService;
    private final NewsletterSubscriptionService newsletterSubscriptionService;

    public PublicNewsletterController(
            NewsletterListService newsletterListService,
            NewsletterSubscriptionService newsletterSubscriptionService
    ) {
        this.newsletterListService = newsletterListService;
        this.newsletterSubscriptionService = newsletterSubscriptionService;
    }

    @GetMapping("/newsletter-lists")
    ResponseEntity<Response<List<PublicNewsletterListView>>> listActiveLists() {
        Long tenantId = TenantContext.requireTenantId();
        List<PublicNewsletterListView> lists = newsletterListService.listLists(tenantId, true).stream()
                .filter(list -> list.getStatus() == NewsletterListStatus.ACTIVE)
                .map(list -> new PublicNewsletterListView(list.getSlug(), list.getName(), list.getDescription()))
                .toList();
        return ResponseEntity.ok(Response.ok(lists));
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

    public record PublicNewsletterListView(String slug, String name, String description) {
    }
}
