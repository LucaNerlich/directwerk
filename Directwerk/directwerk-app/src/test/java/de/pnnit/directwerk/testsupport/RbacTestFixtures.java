package de.pnnit.directwerk.testsupport;

import de.pnnit.directwerk.modules.core.authorization.ContentEntityType;
import de.pnnit.directwerk.modules.core.authorization.ContentOperation;
import de.pnnit.directwerk.modules.core.authorization.RestrictionScope;
import de.pnnit.directwerk.modules.core.entity.MembershipPermissionOverride;

/** Shared builders for RBAC tests (issue #148). */
public final class RbacTestFixtures {

    private RbacTestFixtures() {}

    public static MembershipPermissionOverride override(
            ContentEntityType entity, ContentOperation operation, RestrictionScope scope) {
        MembershipPermissionOverride override = new MembershipPermissionOverride();
        override.setEntityType(entity);
        override.setOperation(operation);
        override.setScope(scope);
        return override;
    }
}
