package de.pnnit.directwerk.security;

import java.util.Set;
import org.springframework.security.core.GrantedAuthority;

public final class RoleConstants {

    public static final String PLATFORM_ADMIN = "ROLE_PLATFORM_ADMIN";
    public static final String TENANT_ADMIN = "ROLE_TENANT_ADMIN";
    public static final String EDITOR = "ROLE_EDITOR";
    public static final String SUBSCRIBER = "ROLE_SUBSCRIBER";
    public static final String GUEST = "ROLE_GUEST";

    private RoleConstants() {
    }

    /** Single home for the recurring EDITOR-or-TENANT_ADMIN authority scan. */
    public static boolean isEditorOrTenantAdmin(DirectwerkUserPrincipal principal) {
        if (principal == null) {
            return false;
        }
        Set<String> wanted = Set.of(EDITOR, TENANT_ADMIN);
        return principal.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch(wanted::contains);
    }
}
