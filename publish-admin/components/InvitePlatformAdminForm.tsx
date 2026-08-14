'use client'

import Form from 'next/form'
import {useActionState} from 'react'

import {Alert, AlertDescription} from '@publish/ui/components/alert'
import {Button} from '@publish/ui/components/button'
import {Card, CardContent, CardHeader, CardTitle} from '@publish/ui/components/card'
import {Input} from '@publish/ui/components/input'
import {Label} from '@publish/ui/components/label'

import {postPlatformData} from '@/lib/api/client'
import {AUTH_REQUIRED, CONFLICT, REQUEST_FAILED} from '@/lib/api/errors'
import type {InvitePlatformAdminResponse} from '@/lib/api/types'
import {validatePlatformAdminInviteInput} from '@/lib/validation'

interface InvitePlatformAdminFormProps {
    onInvited?: () => void
}

interface InvitePlatformAdminState {
    error: string | null
    success: string | null
    inviteToken: string | null
}

const INITIAL_STATE: InvitePlatformAdminState = {
    error: null,
    success: null,
    inviteToken: null,
}

function isInvitePlatformAdminResponse(
    value: unknown
): value is InvitePlatformAdminResponse {
    if (typeof value !== 'object' || value === null) {
        return false
    }

    const response = value as Record<string, unknown>
    return (
        typeof response.userId === 'number' &&
        typeof response.email === 'string' &&
        (response.name === null || typeof response.name === 'string') &&
        typeof response.status === 'string' &&
        (response.inviteToken === null ||
            typeof response.inviteToken === 'string')
    )
}

export default function InvitePlatformAdminForm({
    onInvited,
}: InvitePlatformAdminFormProps) {
    async function inviteAction(
        _previousState: InvitePlatformAdminState,
        formData: FormData
    ): Promise<InvitePlatformAdminState> {
        const validation = validatePlatformAdminInviteInput({
            email: formData.get('email'),
            name: formData.get('name'),
        })

        if (!validation.success) {
            return {
                ...INITIAL_STATE,
                error: validation.error,
            }
        }

        try {
            const response = await postPlatformData<InvitePlatformAdminResponse>(
                'admins/invite',
                validation.data
            )

            if (!isInvitePlatformAdminResponse(response)) {
                return {
                    ...INITIAL_STATE,
                    error: 'Invitation failed. Try again later.',
                }
            }

            onInvited?.()

            return {
                error: null,
                success: `Invitation sent to ${response.email}.`,
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
                    error: 'This user is already a platform admin.',
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
        <Card aria-labelledby="invite-platform-admin-heading" role="region">
            <CardHeader><CardTitle id="invite-platform-admin-heading">Invite platform admin</CardTitle></CardHeader>
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
