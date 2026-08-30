'use client'

import {useActionState, useEffect, useRef, useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Button} from '@directwerk/ui/components/button'

import {postPlatformData} from '@/lib/api/client'
import {AUTH_REQUIRED, CONFLICT, FORBIDDEN} from '@directwerk/api/constants'
import type {TenantUser} from '@directwerk/api/types'
import {PLATFORM_TENANT_INVITABLE_ROLES} from '@directwerk/api/types'
import {getTenantRoleLabel} from '@/lib/roles'

import {changeTenantUserRoleAction} from '@/app/tenants/actions'
import {INITIAL_ROLE_CHANGE_STATE} from '@/app/tenants/actionState'

interface TenantUserActionsProps {
    tenantId: string
    user: TenantUser
    onChanged: () => void
}

export default function TenantUserActions({
    tenantId,
    user,
    onChanged,
}: TenantUserActionsProps) {
    const [statusError, setStatusError] = useState<string | null>(null)
    const [isTogglingStatus, setIsTogglingStatus] = useState(false)
    const [isResendingInvite, setIsResendingInvite] = useState(false)
    const [resendStatus, setResendStatus] = useState<string | null>(null)

    const [roleState, roleAction, rolePending] = useActionState(
        changeTenantUserRoleAction.bind(null, tenantId, user.userId),
        INITIAL_ROLE_CHANGE_STATE
    )

    // Notify the parent once per completed action result (never on mount).
    const handledRoleState = useRef(roleState)
    useEffect(() => {
        if (roleState === handledRoleState.current) {
            return
        }
        handledRoleState.current = roleState
        if (roleState.error === null) {
            onChanged()
        }
    }, [roleState, onChanged])

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

    async function handleResendInvite(): Promise<void> {
        setIsResendingInvite(true)
        setResendStatus(null)
        setStatusError(null)

        try {
            await postPlatformData(`tenants/${tenantId}/users/${user.userId}/resend-invite`, {})
            setResendStatus('Invitation resent.')
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
                requestError.message === CONFLICT
            ) {
                setStatusError('Only invited users can receive a resent invitation.')
                return
            }
            setStatusError('Could not resend invitation.')
        } finally {
            setIsResendingInvite(false)
        }
    }

    return (
        <>
            <form action={roleAction} className="flex min-w-64 flex-wrap gap-2">
                <select className="native-select w-auto flex-1" aria-label="User role" defaultValue={user.roles[0] ?? 'EDITOR'} name="role">
                    {PLATFORM_TENANT_INVITABLE_ROLES.map((role) => (
                        <option key={role} value={role}>
                            {getTenantRoleLabel(role)}
                        </option>
                    ))}
                </select>
                <Button disabled={rolePending} type="submit" variant="outline">
                    {rolePending ? 'Saving…' : 'Change role'}
                </Button>
            </form>
            {roleState.error ? <Alert variant="destructive"><AlertDescription>{roleState.error}</AlertDescription></Alert> : null}
            {user.status === 'INVITED' ? (
                <Button
                    className="mt-2"
                    disabled={isResendingInvite}
                    onClick={() => void handleResendInvite()}
                    type="button"
                    variant="outline"
                >
                    {isResendingInvite ? 'Sending…' : 'Resend invite'}
                </Button>
            ) : null}
            {resendStatus ? (
                <p aria-live="polite" className="mt-2 text-sm text-muted-foreground" role="status">
                    {resendStatus}
                </p>
            ) : null}
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
