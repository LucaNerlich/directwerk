package de.pnnit.directwerk.multitenancy;

public class PlatformTenantAccessDeniedException extends RuntimeException {

    public PlatformTenantAccessDeniedException() {
        super("Platform admin tokens cannot access tenant-scoped endpoints without tenant context");
    }
}
