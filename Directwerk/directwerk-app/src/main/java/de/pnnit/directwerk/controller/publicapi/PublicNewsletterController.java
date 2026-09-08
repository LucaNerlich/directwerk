package de.pnnit.directwerk.controller.publicapi;

import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.email.EmailNotifyModule;
import de.pnnit.directwerk.modules.newsletter.entity.NewsletterList;
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
    @RequiresModule(EmailNotifyModule.KEY)
    ResponseEntity<Response<List<PublicNewsletterListView>>> listLists() {
        Long tenantId = TenantContext.requireTenantId();
        List<PublicNewsletterListView> lists = newsletterListService.listLists(tenantId, true).stream()
                .map(PublicNewsletterController::toPublicView)
                .toList();
        return ResponseEntity.ok(Response.ok(lists));
    }

    @GetMapping("/newsletter-lists/{slug}")
    @RequiresModule(EmailNotifyModule.KEY)
    ResponseEntity<Response<PublicNewsletterListView>> getList(@PathVariable String slug) {
        Long tenantId = TenantContext.requireTenantId();
        NewsletterList list = newsletterListService.requireActiveListBySlug(tenantId, slug);
        return ResponseEntity.ok(Response.ok(toPublicView(list)));
    }

    @PostMapping("/newsletter-lists/{slug}/subscribe")
    @RequiresModule(EmailNotifyModule.KEY)
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

    private static PublicNewsletterListView toPublicView(NewsletterList list) {
        return new PublicNewsletterListView(list.getSlug(), list.getName(), list.getDescription());
    }

    public record PublicNewsletterListView(String slug, String name, String description) {
    }

    public record SubscribeRequest(@NotBlank @Email String email) {
    }

    public record TokenRequest(@NotBlank String token) {
    }
}
