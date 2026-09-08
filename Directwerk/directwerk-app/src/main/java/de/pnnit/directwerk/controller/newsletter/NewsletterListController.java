package de.pnnit.directwerk.controller.newsletter;

import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.newsletter.entity.NewsletterList;
import de.pnnit.directwerk.modules.newsletter.entity.NewsletterListStatus;
import de.pnnit.directwerk.modules.newsletter.entity.NewsletterSubscription;
import de.pnnit.directwerk.modules.newsletter.entity.NewsletterSubscriptionStatus;
import de.pnnit.directwerk.modules.newsletter.service.NewsletterListService;
import de.pnnit.directwerk.modules.newsletter.service.NewsletterSubscriptionService;
import de.pnnit.directwerk.multitenancy.TenantContext;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiresModule("EMAIL_NOTIFY")
@PreAuthorize("hasAnyRole('EDITOR', 'TENANT_ADMIN')")
@RequestMapping("/api/v1/newsletter-lists")
public class NewsletterListController {

    private final NewsletterListService newsletterListService;
    private final NewsletterSubscriptionService newsletterSubscriptionService;

    public NewsletterListController(
            NewsletterListService newsletterListService,
            NewsletterSubscriptionService newsletterSubscriptionService
    ) {
        this.newsletterListService = newsletterListService;
        this.newsletterSubscriptionService = newsletterSubscriptionService;
    }

    @GetMapping
    ResponseEntity<Response<List<NewsletterListView>>> listLists(
            @RequestParam(defaultValue = "false") boolean activeOnly
    ) {
        Long tenantId = TenantContext.requireTenantId();
        List<NewsletterListView> lists = newsletterListService.listLists(tenantId, activeOnly).stream()
                .map(this::toListView)
                .toList();
        return ResponseEntity.ok(Response.ok(lists));
    }

    @GetMapping("/{listId}")
    ResponseEntity<Response<NewsletterListView>> getList(@PathVariable Long listId) {
        Long tenantId = TenantContext.requireTenantId();
        return ResponseEntity.ok(Response.ok(toListView(newsletterListService.requireList(tenantId, listId))));
    }

    @PostMapping
    @PreAuthorize("hasRole('TENANT_ADMIN')")
    ResponseEntity<Response<NewsletterListView>> createList(@Valid @RequestBody CreateNewsletterListRequest request) {
        Long tenantId = TenantContext.requireTenantId();
        NewsletterList list = newsletterListService.createList(
                tenantId,
                request.slug(),
                request.name(),
                request.description()
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(Response.created(toListView(list)));
    }

    @PutMapping("/{listId}")
    @PreAuthorize("hasRole('TENANT_ADMIN')")
    ResponseEntity<Response<NewsletterListView>> updateList(
            @PathVariable Long listId,
            @Valid @RequestBody UpdateNewsletterListRequest request
    ) {
        Long tenantId = TenantContext.requireTenantId();
        NewsletterList list = newsletterListService.updateList(
                tenantId,
                listId,
                request.slug(),
                request.name(),
                request.description(),
                request.status()
        );
        return ResponseEntity.ok(Response.ok(toListView(list)));
    }

    @DeleteMapping("/{listId}")
    @PreAuthorize("hasRole('TENANT_ADMIN')")
    ResponseEntity<Response<NewsletterListView>> archiveList(@PathVariable Long listId) {
        Long tenantId = TenantContext.requireTenantId();
        return ResponseEntity.ok(Response.ok(toListView(newsletterListService.archiveList(tenantId, listId))));
    }

    @GetMapping("/{listId}/subscriptions")
    ResponseEntity<Response<List<NewsletterSubscriptionView>>> listSubscriptions(
            @PathVariable Long listId,
            @RequestParam(required = false) NewsletterSubscriptionStatus status
    ) {
        Long tenantId = TenantContext.requireTenantId();
        List<NewsletterSubscriptionView> rows = newsletterSubscriptionService
                .listSubscriptions(tenantId, listId, status)
                .stream()
                .map(NewsletterListController::toSubscriptionView)
                .toList();
        return ResponseEntity.ok(Response.ok(rows));
    }

    @DeleteMapping("/{listId}/subscriptions/{subscriptionId}")
    @PreAuthorize("hasRole('TENANT_ADMIN')")
    ResponseEntity<Void> removeSubscription(
            @PathVariable Long listId,
            @PathVariable Long subscriptionId
    ) {
        Long tenantId = TenantContext.requireTenantId();
        newsletterSubscriptionService.adminRemove(tenantId, listId, subscriptionId);
        return ResponseEntity.noContent().build();
    }

    private NewsletterListView toListView(NewsletterList list) {
        return new NewsletterListView(
                list.getId(),
                list.getSlug(),
                list.getName(),
                list.getDescription(),
                list.getStatus().name(),
                newsletterListService.countActiveSubscriptions(list.getId()),
                newsletterListService.countPendingSubscriptions(list.getId()),
                list.getCreatedAt(),
                list.getUpdatedAt()
        );
    }

    private static NewsletterSubscriptionView toSubscriptionView(NewsletterSubscription subscription) {
        return new NewsletterSubscriptionView(
                subscription.getId(),
                subscription.getEmail(),
                subscription.getStatus().name(),
                subscription.getSource().name(),
                subscription.getConfirmedAt(),
                subscription.getUnsubscribedAt(),
                subscription.getCreatedAt()
        );
    }

    public record CreateNewsletterListRequest(
            @NotBlank
            @Pattern(regexp = "^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,62}[a-zA-Z0-9])?$")
            String slug,
            @NotBlank @Size(max = 255) String name,
            @Size(max = 4000) String description
    ) {
    }

    public record UpdateNewsletterListRequest(
            @Pattern(regexp = "^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,62}[a-zA-Z0-9])?$")
            String slug,
            @Size(max = 255) String name,
            @Size(max = 4000) String description,
            NewsletterListStatus status
    ) {
    }

    public record NewsletterListView(
            Long id,
            String slug,
            String name,
            String description,
            String status,
            long activeCount,
            long pendingCount,
            Instant createdAt,
            Instant updatedAt
    ) {
    }

    public record NewsletterSubscriptionView(
            Long id,
            String email,
            String status,
            String source,
            Instant confirmedAt,
            Instant unsubscribedAt,
            Instant createdAt
    ) {
    }
}
