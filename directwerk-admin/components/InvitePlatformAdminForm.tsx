'use client'

import Form from 'next/form'
import {useActionState, useEffect, useRef} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Button} from '@directwerk/ui/components/button'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@directwerk/ui/components/card'
import {Input} from '@directwerk/ui/components/input'
import {Label} from '@directwerk/ui/components/label'

import {invitePlatformAdminAction} from '@/app/admins/actions'
import {INITIAL_INVITE_PLATFORM_ADMIN_STATE} from '@/app/admins/actionState'

interface InvitePlatformAdminFormProps {
    onInvited?: () => void
}

export default function InvitePlatformAdminForm({
    onInvited,
}: InvitePlatformAdminFormProps) {
    const [state, formAction, pending] = useActionState(
        invitePlatformAdminAction,
        INITIAL_INVITE_PLATFORM_ADMIN_STATE
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
        <Card aria-labelledby="invite-platform-admin-heading" role="region">
            <CardHeader>
                <CardTitle id="invite-platform-admin-heading">Invite platform admin</CardTitle>
                <CardDescription>
                    Invited admins can manage every tenant. Check the jobs
                    page (email queue) if delivery is in doubt.
                </CardDescription>
            </CardHeader>
            <CardContent>
            <Form action={formAction} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="platform-admin-email">Email</Label>
                    <Input
                        autoComplete="email"
                        id="platform-admin-email"
                        maxLength={254}
                        name="email"
                        required
                        type="email"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="platform-admin-name">Name</Label>
                    <Input
                        autoComplete="name"
                        id="platform-admin-name"
                        maxLength={200}
                        name="name"
                        type="text"
                    />
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
                        <Label htmlFor="platform-admin-invite-token">
                            Dev invite token
                        </Label>
                        <Input
                            id="platform-admin-invite-token"
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
