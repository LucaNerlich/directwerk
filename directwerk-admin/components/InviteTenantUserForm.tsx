'use client'

import Form from 'next/form'
import {useActionState, useEffect, useRef} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Button} from '@directwerk/ui/components/button'
import {Card, CardContent, CardHeader, CardTitle} from '@directwerk/ui/components/card'
import {Input} from '@directwerk/ui/components/input'
import {Label} from '@directwerk/ui/components/label'

import {PLATFORM_TENANT_INVITABLE_ROLES} from '@directwerk/api/types'
import {getTenantRoleLabel} from '@/lib/roles'

import {inviteTenantUserAction} from '@/app/tenants/actions'
import {INITIAL_INVITE_TENANT_USER_STATE} from '@/app/tenants/actionState'

interface InviteTenantUserFormProps {
    tenantId: string
    onInvited?: () => void
}

export default function InviteTenantUserForm({
    tenantId,
    onInvited,
}: InviteTenantUserFormProps) {
    const [state, formAction, pending] = useActionState(
        inviteTenantUserAction.bind(null, tenantId),
        INITIAL_INVITE_TENANT_USER_STATE
    )

    // Notify the parent once per completed action result (never on mount).
    const handledState = useRef(state)
    useEffect(() => {
        if (state === handledState.current) {
            return
        }
        handledState.current = state
        if (state.success !== null) {
            onInvited?.()
        }
    }, [state, onInvited])

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
                    <select className="native-select" defaultValue="EDITOR" id="invite-role" name="role" required>
                        {PLATFORM_TENANT_INVITABLE_ROLES.map((role) => (
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
