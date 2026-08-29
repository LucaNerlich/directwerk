package de.pnnit.directwerk.modules.content;

/** Published when a user's tenant membership becomes {@code ACTIVE}. */
public record TenantMembershipActivatedEvent(Long tenantId, Long userId) {

    public TenantMembershipActivatedEvent {
        if (tenantId == null || userId == null) {
            throw new IllegalArgumentException("tenantId and userId are required");
        }
    }
}
