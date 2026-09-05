'use client'

import Form from 'next/form'
import {useActionState, useEffect, useRef} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Button} from '@directwerk/ui/components/button'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@directwerk/ui/components/card'
import {Input} from '@directwerk/ui/components/input'
import {Label} from '@directwerk/ui/components/label'

import {HTML_SLUG_PATTERN} from '@directwerk/api/constants'
import {MODULE_PRESETS} from '@directwerk/api/types'

import {createTenantAction} from '@/app/tenants/actions'
import {INITIAL_CREATE_TENANT_STATE} from '@/app/tenants/actionState'

interface CreateTenantFormProps {
    onCreated?: () => void
}

export default function CreateTenantForm({onCreated}: CreateTenantFormProps) {
    const [state, formAction, pending] = useActionState(
        createTenantAction,
        INITIAL_CREATE_TENANT_STATE
    )

    // Notify the parent once per completed action result (never on mount).
    const handledState = useRef(state)
    useEffect(() => {
        if (state === handledState.current) {
            return
        }
        handledState.current = state
        if (state.success !== null || state.refreshList) {
            onCreated?.()
        }
    }, [state, onCreated])

    return (
        <Card aria-labelledby="create-tenant-heading" role="region">
            <CardHeader>
                <CardTitle id="create-tenant-heading">Create tenant</CardTitle>
                <CardDescription>
                    Creates the tenant record with an optional module preset.
                    The first admin invitation is optional; omit admin email to
                    create the tenant without one.
                </CardDescription>
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
                        pattern={HTML_SLUG_PATTERN}
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
                {state.inviteToken && process.env.NODE_ENV !== 'production' ? (
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
