'use client'

import Form from 'next/form'
import {useActionState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Button} from '@directwerk/ui/components/button'
import {Card, CardContent, CardHeader, CardTitle} from '@directwerk/ui/components/card'
import {Input} from '@directwerk/ui/components/input'
import {Label} from '@directwerk/ui/components/label'

import {postPlatformData} from '@/lib/api/client'
import {AUTH_REQUIRED, CONFLICT, REQUEST_FAILED} from '@/lib/api/errors'
import type {InviteTenantUserResponse} from '@/lib/api/types'
import {TENANT_INVITABLE_ROLES} from '@/lib/api/types'
import {getTenantRoleLabel} from '@/lib/roles'
import {validateTenantUserInviteInput} from '@/lib/validation'

interface InviteTenantUserFormProps {
    tenantId: string
    onInvited?: () => void
}

interface InviteTenantUserState {
    error: string | null
    success: string | null
    inviteToken: string | null
}

const INITIAL_STATE: InviteTenantUserState = {
    error: null,
    success: null,
    inviteToken: null,
}

function isInviteTenantUserResponse(
    value: unknown
): value is InviteTenantUserResponse {
    if (typeof value !== 'object' || value === null) {
        return false
    }

    const response = value as Record<string, unknown>
    return (
        typeof response.email === 'string' &&
        typeof response.role === 'string' &&
        typeof response.status === 'string' &&
        (response.inviteToken === null ||
            typeof response.inviteToken === 'string')
    )
}

export default function InviteTenantUserForm({
    tenantId,
    onInvited,
}: InviteTenantUserFormProps) {
    async function inviteAction(
        _previousState: InviteTenantUserState,
        formData: FormData
    ): Promise<InviteTenantUserState> {
        const validation = validateTenantUserInviteInput({
            email: formData.get('email'),
            name: formData.get('name'),
            role: formData.get('role'),
        })

        if (!validation.success) {
            return {
                ...INITIAL_STATE,
                error: validation.error,
            }
        }

        try {
            const response = await postPlatformData<InviteTenantUserResponse>(
                `tenants/${tenantId}/users/invite`,
                validation.data
            )

            if (!isInviteTenantUserResponse(response)) {
                return {
                    ...INITIAL_STATE,
                    error: 'Invitation failed. Try again later.',
                }
            }

            onInvited?.()

            return {
                error: null,
                success: `Invitation sent to ${response.email} as ${getTenantRoleLabel(validation.data.role)}.`,
                inviteToken: response.inviteToken,
            }
        } catch (requestError: unknown) {
            if (
                requestError instanceof Error &&
                requestError.message === AUTH_REQUIRED
            ) {
                return {
                    ...INITIAL_STATE,
                    error: 'Your session expired. Sign in again.',
                }
            }

            if (
                requestError instanceof Error &&
                requestError.message === CONFLICT
            ) {
                return {
                    ...INITIAL_STATE,
                    error: 'This user is already a member of the tenant.',
                }
            }

            if (
                requestError instanceof Error &&
                requestError.message === REQUEST_FAILED
            ) {
                return {
                    ...INITIAL_STATE,
                    error: 'Invitation failed. Check the details and try again.',
                }
            }

            return {
                ...INITIAL_STATE,
                error: 'Invitation is unavailable. Try again later.',
            }
        }
    }

    const [state, formAction, pending] = useActionState(
        inviteAction,
        INITIAL_STATE
    )

    return (
        <Card aria-labelledby="invite-tenant-user-heading" role="region">
            <CardHeader><CardTitle id="invite-tenant-user-heading">Invite user</CardTitle></CardHeader>
            <CardContent>
            <Form action={formAction} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="invite-email">Email</Label>
                    <Input
                        autoComplete="email"
                        id="invite-email"
                        maxLength={254}
                        name="email"
                        required
                        type="email"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="invite-name">Name</Label>
                    <Input
                        autoComplete="name"
                        id="invite-name"
                        maxLength={200}
                        name="name"
                        type="text"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="invite-role">Role</Label>
                    <select className="native-select" defaultValue="TENANT_ADMIN" id="invite-role" name="role" required>
                        {TENANT_INVITABLE_ROLES.map((role) => (
                            <option key={role} value={role}>
                                {getTenantRoleLabel(role)}
                            </option>
                        ))}
                    </select>
                </div>
                {state.error ? (
                    <Alert aria-live="polite" variant="destructive"><AlertDescription>{state.error}</AlertDescription></Alert>
                ) : null}
                {state.success ? (
                    <p aria-live="polite" role="status">
                        {state.success}
                    </p>
                ) : null}
                {state.inviteToken ? (
                    <div className="space-y-2">
                        <Label htmlFor="invite-token">Dev invite token</Label>
                        <Input
                            id="invite-token"
                            readOnly
                            type="text"
                            value={state.inviteToken}
                        />
                    </div>
                ) : null}
                <Button disabled={pending} type="submit">
                    {pending ? 'Sending invitation…' : 'Send invitation'}
                </Button>
            </Form>
            </CardContent>
        </Card>
    )
}
