package de.pnnit.directwerk.api.dto;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.core.service.TenantInvitationService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;

@Component
public class InvitationResponseMapper {

    private final DirectwerkConfig directwerkConfig;

    public InvitationResponseMapper(DirectwerkConfig directwerkConfig) {
        this.directwerkConfig = directwerkConfig;
    }

    public ResponseEntity<de.pnnit.directwerk.api.response.Response<InviteUserResponse>> toCreatedResponse(
            TenantInvitationService.InvitationResult invitation
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(de.pnnit.directwerk.api.response.Response.created(toResponse(invitation)));
    }

    public InviteUserResponse toResponse(TenantInvitationService.InvitationResult invitation) {
        return new InviteUserResponse(
                invitation.email(),
                invitation.role(),
                invitation.status(),
                directwerkConfig.isExposeDevTokens() ? invitation.inviteToken() : null
        );
    }
}
