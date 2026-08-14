package de.pnnit.directwerk.api.dto;

public record InviteUserResponse(String email, String role, String status, String inviteToken) {
}
