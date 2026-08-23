'use client'

import Form from 'next/form'
import {useActionState, useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Button} from '@directwerk/ui/components/button'

import {patchPlatformData, postPlatformData} from '@/lib/api/client'
import {AUTH_REQUIRED, CONFLICT, FORBIDDEN, REQUEST_FAILED} from '@/lib/api/errors'
import type {TenantUser} from '@/lib/api/types'
import {TENANT_INVITABLE_ROLES} from '@/lib/api/types'
import {getTenantRoleLabel} from '@/lib/roles'

interface TenantUserActionsProps {
    tenantId: string
    user: TenantUser
    onChanged: () => void
}

interface RoleChangeState {
    error: string | null
}

const INITIAL_ROLE_STATE: RoleChangeState = {error: null}

/**
 * Renders controls for changing a tenant user's role and activation status.
 *
 * @param tenantId - The tenant containing the user
 * @param user - The tenant user whose role or status can be changed
 * @param onChanged - Callback invoked after a successful update
 * @returns Controls for updating the user's role and activation status
 */
export default function TenantUserActions({
    tenantId,
    user,
    onChanged,
}: TenantUserActionsProps) {
    const [statusError, setStatusError] = useState<string | null>(null)
    const [isTogglingStatus, setIsTogglingStatus] = useState(false)

    async function changeRoleAction(
        _previousState: RoleChangeState,
        formData: FormData
    ): Promise<RoleChangeState> {
        const role = String(formData.get('role') ?? '')

        try {
            await patchPlatformData(`tenants/${tenantId}/users/${user.userId}`, {role})
            onChanged()
            return {error: null}
        } catch (requestError: unknown) {
            if (
                requestError instanceof Error &&
                requestError.message === AUTH_REQUIRED
            ) {
                return {error: 'Your session expired. Sign in again.'}
            }
            if (
                requestError instanceof Error &&
                requestError.message === FORBIDDEN
            ) {
                return {error: 'You do not have permission for this action.'}
            }
            if (
                requestError instanceof Error &&
                requestError.message === CONFLICT
            ) {
                return {
                    error:
                        "This would leave the tenant without an active admin, or you're trying to change your own access.",
                }
            }
            if (
                requestError instanceof Error &&
                requestError.message === REQUEST_FAILED
            ) {
                return {error: 'Role change failed. Try again.'}
            }
            return {error: 'Role change is unavailable.'}
        }
    }

    const [roleState, roleAction, rolePending] = useActionState(
        changeRoleAction,
        INITIAL_ROLE_STATE
    )

    async function handleToggleStatus(): Promise<void> {
        const deactivating = user.status === 'ACTIVE'
        if (
            deactivating &&
            !window.confirm(
                `Deactivate this user (${user.email})? They will immediately lose access.`,
            )
        ) {
            return
        }
        setIsTogglingStatus(true)
        setStatusError(null)
        const path =
            user.status === 'ACTIVE'
                ? `tenants/${tenantId}/users/${user.userId}/deactivate`
                : `tenants/${tenantId}/users/${user.userId}/reactivate`

        try {
            await postPlatformData(path, {})
            onChanged()
        } catch (requestError: unknown) {
            if (
                requestError instanceof Error &&
                requestError.message === AUTH_REQUIRED
            ) {
                setStatusError('Your session expired. Sign in again.')
                return
            }
            if (
                requestError instanceof Error &&
                requestError.message === FORBIDDEN
            ) {
                setStatusError('You do not have permission for this action.')
                return
            }
            if (
                requestError instanceof Error &&
                requestError.message === CONFLICT
            ) {
                setStatusError(
                    "This would leave the tenant without an active admin, or you're trying to change your own access."
                )
                return
            }
            setStatusError('Status change failed. Try again.')
        } finally {
            setIsTogglingStatus(false)
        }
    }

    return (
        <>
            <Form action={roleAction} className="flex min-w-64 flex-wrap gap-2">
                <select className="native-select w-auto flex-1" aria-label="User role" defaultValue={user.roles[0] ?? 'GUEST'} name="role">
                    {TENANT_INVITABLE_ROLES.map((role) => (
                        <option key={role} value={role}>
                            {getTenantRoleLabel(role)}
                        </option>
                    ))}
                </select>
                <Button disabled={rolePending} type="submit" variant="outline">
                    {rolePending ? 'Saving…' : 'Change role'}
                </Button>
            </Form>
            {roleState.error ? <Alert variant="destructive"><AlertDescription>{roleState.error}</AlertDescription></Alert> : null}
            <Button
                className="mt-2"
                disabled={isTogglingStatus}
                onClick={() => void handleToggleStatus()}
                type="button"
                variant={user.status === 'ACTIVE' ? 'destructive' : 'outline'}
            >
                {isTogglingStatus
                    ? 'Working…'
                    : user.status === 'ACTIVE'
                      ? 'Deactivate'
                      : 'Reactivate'}
            </Button>
            {statusError ? <Alert variant="destructive"><AlertDescription>{statusError}</AlertDescription></Alert> : null}
        </>
    )
}
