package de.pnnit.directwerk.modules.email.esp;

import de.pnnit.directwerk.modules.core.exception.CodedStatusException;

/** No active TENANT_ADMIN memberships with deliverable emails for the tenant. */
public class NoTenantAdminsException extends CodedStatusException {

    public NoTenantAdminsException(String message) {
        super(400, "NO_TENANT_ADMINS", message);
    }
}
