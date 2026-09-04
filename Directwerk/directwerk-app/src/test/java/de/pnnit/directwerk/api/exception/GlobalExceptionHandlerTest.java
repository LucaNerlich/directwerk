package de.pnnit.directwerk.api.exception;

import static org.assertj.core.api.Assertions.assertThat;

import de.pnnit.directwerk.modules.core.service.CannotDeactivateLastAdminException;
import de.pnnit.directwerk.modules.core.service.CannotDeactivateSelfException;
import de.pnnit.directwerk.modules.core.service.CannotRevokeLastPlatformAdminException;
import de.pnnit.directwerk.modules.core.service.CannotRevokeSelfException;
import de.pnnit.directwerk.modules.core.service.DomainAlreadyExistsException;
import de.pnnit.directwerk.modules.core.service.PlatformAdminNotFoundException;
import de.pnnit.directwerk.modules.core.service.TenantMembershipNotFoundException;
import de.pnnit.directwerk.multitenancy.TenantContextMissingException;
import de.pnnit.directwerk.multitenancy.TenantSuspendedException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void mapsTenantContextMissingToBadRequest() {
        var response = handler.handleTenantContextMissing(new TenantContextMissingException());
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody().errors().getFirst().code()).isEqualTo("TENANT_REQUIRED");
    }

    @Test
    void mapsTenantSuspendedToForbidden() {
        var response = handler.handleTenantSuspended(new TenantSuspendedException("demo.localhost"));
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(response.getBody().errors().getFirst().code()).isEqualTo("TENANT_SUSPENDED");
    }

    @Test
    void mapsDuplicateDomainToConflict() {
        var response = handler.handleDomainAlreadyExists(new DomainAlreadyExistsException("taken.example.com"));
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody().errors().getFirst().code()).isEqualTo("DOMAIN_ALREADY_EXISTS");
    }

    @Test
    void mapsCannotDeactivateSelfToConflict() {
        var response = handler.handleCannotDeactivateSelf(new CannotDeactivateSelfException(5L));
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody().errors().getFirst().code()).isEqualTo("CANNOT_DEACTIVATE_SELF");
    }

    @Test
    void mapsCannotDeactivateLastAdminToConflict() {
        var response = handler.handleCannotDeactivateLastAdmin(new CannotDeactivateLastAdminException(5L));
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody().errors().getFirst().code()).isEqualTo("CANNOT_DEACTIVATE_LAST_ADMIN");
    }

    @Test
    void mapsTenantMembershipNotFoundToNotFound() {
        var response = handler.handleTenantMembershipNotFound(new TenantMembershipNotFoundException(1L, 5L));
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody().errors().getFirst().code()).isEqualTo("TENANT_MEMBERSHIP_NOT_FOUND");
    }

    @Test
    void mapsPlatformAdminNotFoundToNotFound() {
        var response = handler.handlePlatformAdminNotFound(new PlatformAdminNotFoundException(5L));
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody().errors().getFirst().code()).isEqualTo("PLATFORM_ADMIN_NOT_FOUND");
    }

    @Test
    void mapsCannotRevokeSelfToConflict() {
        var response = handler.handleCannotRevokeSelf(new CannotRevokeSelfException(5L));
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody().errors().getFirst().code()).isEqualTo("CANNOT_REVOKE_SELF");
    }

    @Test
    void mapsCannotRevokeLastPlatformAdminToConflict() {
        var response = handler.handleCannotRevokeLastPlatformAdmin(new CannotRevokeLastPlatformAdminException(5L));
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody().errors().getFirst().code()).isEqualTo("CANNOT_REVOKE_LAST_ADMIN");
    }

    @Test
    void mapsUnexpectedExceptionToInternalErrorEnvelope() {
        var response = handler.handleUnexpected(new NullPointerException("boom"));
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(response.getBody().errors().getFirst().code()).isEqualTo("INTERNAL_ERROR");
    }

    @Test
    void dataIntegrityViolationNeverEchoesRawSqlMessage() {
        var cause = new RuntimeException(
                "ERROR: duplicate key value violates unique constraint \"episodes_tenant_id_slug_key\" "
                        + "Detail: Key (tenant_id, slug)=(7, hello) already exists.");
        var ex = new org.springframework.dao.DataIntegrityViolationException(
                "could not execute statement [insert into episodes (tenant_id,slug) values (?,?)]; "
                        + "SQL [insert into episodes]; constraint [episodes_tenant_id_slug_key]",
                cause);

        var response = handler.handleDataIntegrity(ex);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody().errors().getFirst().code()).isEqualTo("TENANT_SLUG_EXISTS");
        assertThat(response.getBody().errors().getFirst().message()).doesNotContain("insert into");
    }

    @Test
    void dataIntegrityFallbackUsesGenericMessage() {
        var ex = new org.springframework.dao.DataIntegrityViolationException(
                "could not execute statement [delete from tenants]; SQL [delete]; constraint [fk_secret_internal]");

        var response = handler.handleDataIntegrity(ex);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody().errors().getFirst().code()).isEqualTo("CONFLICT");
        assertThat(response.getBody().errors().getFirst().message()).doesNotContain("fk_secret_internal");
    }
}
