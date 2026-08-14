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
import type {TenantCreationResponse} from '@/lib/api/types'
import {MODULE_PRESETS} from '@/lib/api/types'
import {validateCreateTenantInput} from '@/lib/validation'

interface CreateTenantFormProps {
    onCreated?: () => void
}

interface CreateTenantState {
    error: string | null
    success: string | null
    inviteToken: string | null
}

const INITIAL_STATE: CreateTenantState = {
    error: null,
    success: null,
    inviteToken: null,
}

function isTenantCreationResponse(
    value: unknown
): value is TenantCreationResponse {
    if (typeof value !== 'object' || value === null) {
        return false
    }

    const response = value as Record<string, unknown>
    if (
        typeof response.id !== 'number' ||
        typeof response.slug !== 'string' ||
        typeof response.name !== 'string' ||
        typeof response.status !== 'string'
    ) {
        return false
    }

    if (response.adminInvitation == null) {
        return true
    }

    if (typeof response.adminInvitation !== 'object') {
        return false
    }

    const invitation = response.adminInvitation as Record<string, unknown>
    return (
        typeof invitation.email === 'string' &&
        typeof invitation.status === 'string' &&
        (invitation.inviteToken === null ||
            invitation.inviteToken === undefined ||
            typeof invitation.inviteToken === 'string')
    )
}

export default function CreateTenantForm({onCreated}: CreateTenantFormProps) {
    async function createAction(
        _previousState: CreateTenantState,
        formData: FormData
    ): Promise<CreateTenantState> {
        const validation = validateCreateTenantInput({
            name: formData.get('name'),
            slug: formData.get('slug'),
            primaryDomain: formData.get('primaryDomain'),
            modulePreset: formData.get('modulePreset'),
            adminEmail: formData.get('adminEmail'),
            adminName: formData.get('adminName'),
        })

        if (!validation.success) {
            return {
                ...INITIAL_STATE,
                error: validation.error,
            }
        }

        try {
            const response = await postPlatformData<TenantCreationResponse>(
                'tenants',
                validation.data
            )

            if (!isTenantCreationResponse(response)) {
                return {
                    ...INITIAL_STATE,
                    error: 'Tenant creation failed. Try again later.',
                }
            }

            onCreated?.()

            return {
                error: null,
                success: `Created tenant ${response.name} (${response.slug}).`,
                inviteToken: response.adminInvitation?.inviteToken ?? null,
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
                    error: 'A tenant with this slug already exists.',
                }
            }

            if (
                requestError instanceof Error &&
                requestError.message === REQUEST_FAILED
            ) {
                return {
                    ...INITIAL_STATE,
                    error: 'Tenant creation failed. Check the details and try again.',
                }
            }

            return {
                ...INITIAL_STATE,
                error: 'Tenant creation is unavailable. Try again later.',
            }
        }
    }

    const [state, formAction, pending] = useActionState(
        createAction,
        INITIAL_STATE
    )

    return (
        <Card aria-labelledby="create-tenant-heading" role="region">
            <CardHeader>
                <CardTitle id="create-tenant-heading">Create tenant</CardTitle>
            </CardHeader>
            <CardContent>
            <Form action={formAction} className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor="create-tenant-name">Name</Label>
                    <Input
                        id="create-tenant-name"
                        maxLength={255}
                        name="name"
                        required
                        type="text"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="create-tenant-slug">Slug</Label>
                    <Input
                        id="create-tenant-slug"
                        maxLength={64}
                        name="slug"
                        pattern="^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,62}[a-zA-Z0-9])?$"
                        required
                        type="text"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="create-tenant-domain">Primary domain</Label>
                    <Input
                        id="create-tenant-domain"
                        maxLength={253}
                        name="primaryDomain"
                        placeholder="example.localhost"
                        type="text"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="create-tenant-preset">Module preset</Label>
                    <select
                        className="native-select"
                        defaultValue=""
                        id="create-tenant-preset"
                        name="modulePreset"
                    >
                        <option value="">None</option>
                        {MODULE_PRESETS.map((preset) => (
                            <option key={preset} value={preset}>
                                {preset}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="create-tenant-admin-email">
                        Admin email
                    </Label>
                    <Input
                        autoComplete="email"
                        id="create-tenant-admin-email"
                        maxLength={254}
                        name="adminEmail"
                        type="email"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="create-tenant-admin-name">Admin name</Label>
                    <Input
                        id="create-tenant-admin-name"
                        maxLength={255}
                        name="adminName"
                        type="text"
                    />
                </div>
                {state.error ? (
                    <Alert aria-live="polite" className="md:col-span-2" variant="destructive">
                        <AlertDescription>{state.error}</AlertDescription>
                    </Alert>
                ) : null}
                {state.success ? (
                    <p aria-live="polite" className="text-sm text-muted-foreground md:col-span-2" role="status">
                        {state.success}
                    </p>
                ) : null}
                {state.inviteToken ? (
                    <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="create-tenant-invite-token">
                            Dev invite token
                        </Label>
                        <Input
                            id="create-tenant-invite-token"
                            readOnly
                            type="text"
                            value={state.inviteToken}
                        />
                    </div>
                ) : null}
                <Button className="w-fit md:col-span-2" disabled={pending} type="submit">
                    {pending ? 'Creating…' : 'Create tenant'}
                </Button>
            </Form>
            </CardContent>
        </Card>
    )
}
