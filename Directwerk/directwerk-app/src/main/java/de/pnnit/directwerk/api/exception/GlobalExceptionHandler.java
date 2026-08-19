package de.pnnit.directwerk.api.exception;

import de.pnnit.directwerk.api.response.ErrorDetail;
import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.modules.core.service.CannotDeactivateCoreModuleException;
import de.pnnit.directwerk.modules.core.service.CannotDeactivateLastAdminException;
import de.pnnit.directwerk.modules.core.service.CannotDeactivateSelfException;
import de.pnnit.directwerk.modules.core.service.CannotRevokeLastPlatformAdminException;
import de.pnnit.directwerk.modules.core.service.CannotRevokeSelfException;
import de.pnnit.directwerk.modules.core.service.ModuleDependencyMissingException;
import de.pnnit.directwerk.modules.core.service.ModuleNotEnabledException;
import de.pnnit.directwerk.modules.core.service.PlatformAdminNotFoundException;
import de.pnnit.directwerk.modules.core.service.TenantMembershipNotFoundException;
import de.pnnit.directwerk.modules.digital.exception.AssetAccessDeniedException;
import de.pnnit.directwerk.modules.digital.exception.EntitlementDeniedException;
import de.pnnit.directwerk.modules.digital.exception.MediaAssetNotFoundException;
import de.pnnit.directwerk.modules.digital.exception.StorageNotConfiguredException;
import de.pnnit.directwerk.modules.digital.exception.UploadValidationException;
import de.pnnit.directwerk.modules.newsletter.exception.ArticleNotFoundException;
import de.pnnit.directwerk.modules.newsletter.exception.ArticleValidationException;
import de.pnnit.directwerk.modules.digital.exception.CategoryNotFoundException;
import de.pnnit.directwerk.modules.podcast.exception.EpisodeNotFoundException;
import de.pnnit.directwerk.modules.podcast.exception.EpisodeValidationException;
import de.pnnit.directwerk.modules.podcast.exception.FormatNotFoundException;
import de.pnnit.directwerk.modules.digital.exception.InvalidPublicationTransitionException;
import de.pnnit.directwerk.modules.podcast.exception.SeriesNotFoundException;
import de.pnnit.directwerk.modules.podcast.feed.FeedBuilderException;
import de.pnnit.directwerk.modules.podcast.feed.SubscriberFeedNotFoundException;
import de.pnnit.directwerk.modules.queue.JobConflictException;
import de.pnnit.directwerk.modules.queue.JobNotFoundException;
import de.pnnit.directwerk.modules.subscription.exception.StripeApiException;
import de.pnnit.directwerk.modules.subscription.exception.StripeConnectNotReadyException;
import de.pnnit.directwerk.modules.subscription.exception.StripeNotConfiguredException;
import de.pnnit.directwerk.modules.subscription.exception.StripeSignatureException;
import de.pnnit.directwerk.modules.subscription.exception.SubscriptionNotFoundException;
import de.pnnit.directwerk.modules.subscription.exception.SubscriptionProductNotFoundException;
import de.pnnit.directwerk.multitenancy.PlatformTenantAccessDeniedException;
import de.pnnit.directwerk.multitenancy.TenantContextMissingException;
import de.pnnit.directwerk.multitenancy.TenantMismatchException;
import de.pnnit.directwerk.multitenancy.TenantNotFoundException;
import de.pnnit.directwerk.multitenancy.TenantSuspendedException;
import de.pnnit.directwerk.modules.core.service.DomainAlreadyExistsException;
import de.pnnit.directwerk.modules.core.service.DomainVerificationException;
import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(TenantContextMissingException.class)
    ResponseEntity<Response<Void>> handleTenantContextMissing(TenantContextMissingException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Response.error(400, "TENANT_REQUIRED", ex.getMessage()));
    }

    @ExceptionHandler(TenantSuspendedException.class)
    ResponseEntity<Response<Void>> handleTenantSuspended(TenantSuspendedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Response.error(403, "TENANT_SUSPENDED", ex.getMessage()));
    }

    /**
     * Handles attempts to create or register a domain that already exists.
     *
     * @return a conflict response with the {@code DOMAIN_ALREADY_EXISTS} error code and exception message
     */
    @ExceptionHandler(DomainAlreadyExistsException.class)
    ResponseEntity<Response<Void>> handleDomainAlreadyExists(DomainAlreadyExistsException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(Response.error(409, "DOMAIN_ALREADY_EXISTS", ex.getMessage()));
    }

    /**
     * Handles domain verification failures.
     *
     * @param ex the domain verification exception
     * @return a bad-request response containing the verification failure details
     */
    @ExceptionHandler(DomainVerificationException.class)
    ResponseEntity<Response<Void>> handleDomainVerification(DomainVerificationException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Response.error(400, "DOMAIN_VERIFICATION_FAILED", ex.getMessage()));
    }

    /**
     * Handles requests that reference a tenant that cannot be found.
     *
     * @param ex the exception containing the tenant lookup failure message
     * @return a 404 response with the {@code TENANT_NOT_FOUND} error code and exception message
     */
    @ExceptionHandler(TenantNotFoundException.class)
    ResponseEntity<Response<Void>> handleTenantNotFound(TenantNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Response.error(404, "TENANT_NOT_FOUND", ex.getMessage()));
    }

    @ExceptionHandler(TenantMismatchException.class)
    ResponseEntity<Response<Void>> handleTenantMismatch(TenantMismatchException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Response.error(403, "TENANT_MISMATCH", ex.getMessage()));
    }

    @ExceptionHandler(PlatformTenantAccessDeniedException.class)
    ResponseEntity<Response<Void>> handlePlatformTenantAccess(PlatformTenantAccessDeniedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Response.error(403, "PLATFORM_TENANT_ACCESS_DENIED", ex.getMessage()));
    }

    @ExceptionHandler(ModuleNotEnabledException.class)
    ResponseEntity<Response<Void>> handleModuleNotEnabled(ModuleNotEnabledException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Response.error(403, "FEATURE_NOT_ENABLED", ex.getMessage()));
    }

    @ExceptionHandler(EntitlementDeniedException.class)
    ResponseEntity<Response<Void>> handleEntitlementDenied(EntitlementDeniedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Response.error(403, "ENTITLEMENT_DENIED", ex.getMessage()));
    }

    @ExceptionHandler(AssetAccessDeniedException.class)
    ResponseEntity<Response<Void>> handleAssetAccessDenied(AssetAccessDeniedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Response.error(403, "ASSET_ACCESS_DENIED", ex.getMessage()));
    }

    @ExceptionHandler(MediaAssetNotFoundException.class)
    ResponseEntity<Response<Void>> handleMediaAssetNotFound(MediaAssetNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Response.error(404, "MEDIA_ASSET_NOT_FOUND", ex.getMessage()));
    }

    @ExceptionHandler(UploadValidationException.class)
    ResponseEntity<Response<Void>> handleUploadValidation(UploadValidationException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Response.error(400, ex.getCode(), ex.getMessage()));
    }

    @ExceptionHandler(StorageNotConfiguredException.class)
    ResponseEntity<Response<Void>> handleStorageNotConfigured(StorageNotConfiguredException ex) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(Response.error(503, "STORAGE_NOT_CONFIGURED", ex.getMessage()));
    }

    @ExceptionHandler(StripeNotConfiguredException.class)
    ResponseEntity<Response<Void>> handleStripeNotConfigured(StripeNotConfiguredException ex) {
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED)
                .body(Response.error(501, "STRIPE_NOT_IMPLEMENTED", ex.getMessage()));
    }

    @ExceptionHandler(StripeConnectNotReadyException.class)
    ResponseEntity<Response<Void>> handleStripeConnectNotReady(StripeConnectNotReadyException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(Response.error(409, "STRIPE_NOT_CONNECTED", ex.getMessage()));
    }

    @ExceptionHandler(StripeSignatureException.class)
    ResponseEntity<Response<Void>> handleStripeSignature(StripeSignatureException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Response.error(400, "STRIPE_SIGNATURE_INVALID", "Stripe webhook signature is invalid"));
    }

    @ExceptionHandler(StripeApiException.class)
    ResponseEntity<Response<Void>> handleStripeApi(StripeApiException ex) {
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                .body(Response.error(502, "STRIPE_REQUEST_FAILED", "Stripe request failed"));
    }

    @ExceptionHandler(ModuleDependencyMissingException.class)
    ResponseEntity<Response<Void>> handleModuleDependencyMissing(ModuleDependencyMissingException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(Response.error(409, "MODULE_DEPENDENCY_MISSING", ex.getMessage()));
    }

    @ExceptionHandler(CannotDeactivateCoreModuleException.class)
    ResponseEntity<Response<Void>> handleCannotDeactivateCoreModule(CannotDeactivateCoreModuleException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(Response.error(409, "CANNOT_DEACTIVATE_CORE_MODULE", ex.getMessage()));
    }

    /**
     * Handles attempts by a tenant admin to deactivate their own membership.
     *
     * @param ex the exception describing the self-deactivation attempt
     * @return a conflict response with the {@code CANNOT_DEACTIVATE_SELF} error code
     */
    @ExceptionHandler(CannotDeactivateSelfException.class)
    ResponseEntity<Response<Void>> handleCannotDeactivateSelf(CannotDeactivateSelfException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(Response.error(409, "CANNOT_DEACTIVATE_SELF", ex.getMessage()));
    }

    /**
     * Handles attempts to deactivate the last remaining active tenant admin.
     *
     * @param ex the exception describing the last-admin deactivation attempt
     * @return a conflict response with the {@code CANNOT_DEACTIVATE_LAST_ADMIN} error code
     */
    @ExceptionHandler(CannotDeactivateLastAdminException.class)
    ResponseEntity<Response<Void>> handleCannotDeactivateLastAdmin(CannotDeactivateLastAdminException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(Response.error(409, "CANNOT_DEACTIVATE_LAST_ADMIN", ex.getMessage()));
    }

    /**
     * Handles requests that reference a tenant membership that cannot be found.
     *
     * @param ex the exception containing the membership lookup failure message
     * @return a 404 response with the {@code TENANT_MEMBERSHIP_NOT_FOUND} error code
     */
    @ExceptionHandler(TenantMembershipNotFoundException.class)
    ResponseEntity<Response<Void>> handleTenantMembershipNotFound(TenantMembershipNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Response.error(404, "TENANT_MEMBERSHIP_NOT_FOUND", ex.getMessage()));
    }

    /**
     * Handles requests that reference a platform administrator that does not exist.
     *
     * @return an error response with HTTP status 404 and code {@code PLATFORM_ADMIN_NOT_FOUND}
     */
    @ExceptionHandler(PlatformAdminNotFoundException.class)
    ResponseEntity<Response<Void>> handlePlatformAdminNotFound(PlatformAdminNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Response.error(404, "PLATFORM_ADMIN_NOT_FOUND", ex.getMessage()));
    }

    /**
     * Handles attempts to revoke the current administrator's access.
     *
     * @param ex the exception describing the revocation conflict
     * @return a conflict response with the exception message
     */
    @ExceptionHandler(CannotRevokeSelfException.class)
    ResponseEntity<Response<Void>> handleCannotRevokeSelf(CannotRevokeSelfException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(Response.error(409, "CANNOT_REVOKE_SELF", ex.getMessage()));
    }

    /**
     * Handles attempts to revoke the last platform administrator.
     *
     * @param ex the exception describing why the revocation cannot proceed
     * @return a conflict response containing the error details
     */
    @ExceptionHandler(CannotRevokeLastPlatformAdminException.class)
    ResponseEntity<Response<Void>> handleCannotRevokeLastPlatformAdmin(CannotRevokeLastPlatformAdminException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(Response.error(409, "CANNOT_REVOKE_LAST_ADMIN", ex.getMessage()));
    }

    /**
     * Handles missing subscription product errors.
     *
     * @param ex the exception containing the error details
     * @return a not-found error response for the missing subscription product
     */
    @ExceptionHandler(SubscriptionProductNotFoundException.class)
    ResponseEntity<Response<Void>> handleSubscriptionProductNotFound(SubscriptionProductNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Response.error(404, "PRODUCT_NOT_FOUND", ex.getMessage()));
    }

    @ExceptionHandler(SeriesNotFoundException.class)
    ResponseEntity<Response<Void>> handleSeriesNotFound(SeriesNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Response.error(404, "SERIES_NOT_FOUND", ex.getMessage()));
    }

    @ExceptionHandler(EpisodeNotFoundException.class)
    ResponseEntity<Response<Void>> handleEpisodeNotFound(EpisodeNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Response.error(404, "EPISODE_NOT_FOUND", ex.getMessage()));
    }

    @ExceptionHandler(ArticleNotFoundException.class)
    ResponseEntity<Response<Void>> handleArticleNotFound(ArticleNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Response.error(404, "ARTICLE_NOT_FOUND", ex.getMessage()));
    }

    @ExceptionHandler(FormatNotFoundException.class)
    ResponseEntity<Response<Void>> handleFormatNotFound(FormatNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Response.error(404, "FORMAT_NOT_FOUND", ex.getMessage()));
    }

    @ExceptionHandler(CategoryNotFoundException.class)
    ResponseEntity<Response<Void>> handleCategoryNotFound(CategoryNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Response.error(404, "CATEGORY_NOT_FOUND", ex.getMessage()));
    }

    @ExceptionHandler(SubscriberFeedNotFoundException.class)
    ResponseEntity<Response<Void>> handleSubscriberFeedNotFound(SubscriberFeedNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Response.error(404, "SUBSCRIBER_FEED_NOT_FOUND", ex.getMessage()));
    }

    @ExceptionHandler(FeedBuilderException.class)
    ResponseEntity<Response<Void>> handleFeedBuilder(FeedBuilderException ex) {
        return ResponseEntity.status(ex.getStatus())
                .body(Response.error(ex.getStatus(), ex.getCode(), ex.getMessage()));
    }

    @ExceptionHandler(InvalidPublicationTransitionException.class)
    ResponseEntity<Response<Void>> handleInvalidPublicationTransition(InvalidPublicationTransitionException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(Response.error(409, "PUBLICATION_INVALID_TRANSITION", ex.getMessage()));
    }

    @ExceptionHandler(EpisodeValidationException.class)
    ResponseEntity<Response<Void>> handleEpisodeValidation(EpisodeValidationException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Response.error(400, "EPISODE_VALIDATION_FAILED", ex.getMessage()));
    }

    @ExceptionHandler(ArticleValidationException.class)
    ResponseEntity<Response<Void>> handleArticleValidation(ArticleValidationException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Response.error(400, "ARTICLE_VALIDATION_FAILED", ex.getMessage()));
    }

    /**
     * Handles missing subscription errors.
     *
     * @param ex the exception describing the missing subscription
     * @return a not-found response containing the subscription error details
     */
    @ExceptionHandler(SubscriptionNotFoundException.class)
    ResponseEntity<Response<Void>> handleSubscriptionNotFound(SubscriptionNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Response.error(404, "SUBSCRIPTION_NOT_FOUND", ex.getMessage()));
    }

    /**
     * Handles a missing job by returning a standardized not-found error response.
     *
     * @param ex the exception describing the missing job
     * @return a 404 response containing the job-not-found error
     */
    @ExceptionHandler(JobNotFoundException.class)
    ResponseEntity<Response<Void>> handleJobNotFound(JobNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Response.error(404, "JOB_NOT_FOUND", ex.getMessage()));
    }

    /**
     * Handles job conflict exceptions by returning a standardized conflict response.
     *
     * @param ex the exception describing the job conflict
     * @return a response with HTTP status 409 and the conflict details
     */
    @ExceptionHandler(JobConflictException.class)
    ResponseEntity<Response<Void>> handleJobConflict(JobConflictException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(Response.error(409, "JOB_CONFLICT", ex.getMessage()));
    }

    /**
     * Handles access-denied errors by returning a standardized forbidden response.
     *
     * @param ex the access-denied exception
     * @return a forbidden error response
     */
    @ExceptionHandler(AccessDeniedException.class)
    ResponseEntity<Response<Void>> handleAccessDenied(AccessDeniedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Response.error(403, "ACCESS_DENIED", "Forbidden"));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    ResponseEntity<Response<Void>> handleIllegalArgument(IllegalArgumentException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Response.error(400, "VALIDATION_ERROR", ex.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<Response<Void>> handleValidation(MethodArgumentNotValidException ex) {
        var errors = ex.getBindingResult().getFieldErrors().stream()
                .map(fieldError -> new ErrorDetail(
                        "VALIDATION_ERROR",
                        fieldError.getDefaultMessage(),
                        fieldError.getField()
                ))
                .toList();
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Response.error(400, "Validation failed", errors));
    }

    @ExceptionHandler(ConstraintViolationException.class)
    ResponseEntity<Response<Void>> handleConstraintViolation(ConstraintViolationException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Response.error(400, "VALIDATION_ERROR", ex.getMessage()));
    }

    @ExceptionHandler(BadCredentialsException.class)
    ResponseEntity<Response<Void>> handleBadCredentials(BadCredentialsException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Response.error(401, "INVALID_CREDENTIALS", "Invalid credentials"));
    }

    /**
     * Defense-in-depth catch-all for any exception not explicitly mapped above. Without this,
     * an unmapped exception (e.g. a bug in a mapper, an unexpected {@code NullPointerException},
     * or a {@code DataIntegrityViolationException} from a DB constraint with no application-level
     * pre-check) falls through to Spring Boot's default error page - a bare
     * {@code {"timestamp":...,"status":500,"error":"Internal Server Error",...}} body instead of
     * this API's {@link Response} envelope. This handler guarantees every response leaving the API
     * uses the same envelope, and logs the exception server-side so it isn't silently swallowed.
     *
     * <p>This is a safety net, not a substitute for mapping specific exceptions above - prefer
     * adding a dedicated handler when a new failure mode is identified.
     *
     * @param ex the unmapped exception
     * @return a generic 500 response using the standard error envelope
     */
    @ExceptionHandler(Exception.class)
    ResponseEntity<Response<Void>> handleUnexpected(Exception ex) {
        log.error("Unhandled exception reached GlobalExceptionHandler catch-all", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Response.error(500, "INTERNAL_ERROR", "An unexpected error occurred"));
    }
}
