package de.pnnit.directwerk.modules.content;

/** Signals that generated subscriber feeds for a tenant may have changed. */
public record TenantEntitlementsChangedEvent(Long tenantId) {

    public TenantEntitlementsChangedEvent {
        if (tenantId == null || tenantId < 1) {
            throw new IllegalArgumentException("tenantId must be a positive id");
        }
    }
}
