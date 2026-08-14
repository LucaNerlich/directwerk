package de.pnnit.directwerk.modules.core.audit;

public final class PlatformAuditActions {

    public static final String TENANT_CREATED = "TENANT_CREATED";
    public static final String TENANT_SUSPENDED = "TENANT_SUSPENDED";
    public static final String TENANT_REACTIVATED = "TENANT_REACTIVATED";
    public static final String TENANT_UPDATED = "TENANT_UPDATED";
    public static final String MODULE_ACTIVATED = "MODULE_ACTIVATED";
    public static final String MODULE_DEACTIVATED = "MODULE_DEACTIVATED";
    public static final String DOMAIN_ADDED = "DOMAIN_ADDED";
    public static final String DOMAIN_VERIFIED = "DOMAIN_VERIFIED";
    public static final String DOMAIN_FORCE_VERIFIED = "DOMAIN_FORCE_VERIFIED";
    public static final String USER_INVITED = "USER_INVITED";
    public static final String MEMBERSHIP_DEACTIVATED = "MEMBERSHIP_DEACTIVATED";
    public static final String MEMBERSHIP_REACTIVATED = "MEMBERSHIP_REACTIVATED";
    public static final String MEMBERSHIP_ROLE_CHANGED = "MEMBERSHIP_ROLE_CHANGED";
    public static final String PLATFORM_ADMIN_REVOKED = "PLATFORM_ADMIN_REVOKED";

    private PlatformAuditActions() {
    }
}
