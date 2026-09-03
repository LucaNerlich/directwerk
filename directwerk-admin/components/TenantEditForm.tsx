'use client'

import Form from 'next/form'
import {useActionState, useEffect, useRef} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Button} from '@directwerk/ui/components/button'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@directwerk/ui/components/card'
import {Input} from '@directwerk/ui/components/input'
import {Label} from '@directwerk/ui/components/label'

import type {TenantDetail} from '@directwerk/api/types'

import {updateTenantAction} from '@/app/tenants/actions'
import {INITIAL_TENANT_EDIT_STATE} from '@/app/tenants/actionState'

interface TenantEditFormProps {
    tenantId: string
    tenant: TenantDetail
    onUpdated?: (tenant: TenantDetail) => void
}

export default function TenantEditForm({
    tenantId,
    tenant,
    onUpdated,
}: TenantEditFormProps) {
    const [state, formAction, pending] = useActionState(
        updateTenantAction.bind(null, tenantId),
        INITIAL_TENANT_EDIT_STATE
    )

    // Notify the parent once per completed action result (never on mount).
    const handledState = useRef(state)
    useEffect(() => {
        if (state === handledState.current) {
            return
        }
        handledState.current = state
        if (state.tenant !== null) {
            onUpdated?.(state.tenant)
        }
    }, [state, onUpdated])

    return (
        <Card aria-labelledby="tenant-edit-heading" role="region">
            <CardHeader>
                <CardTitle id="tenant-edit-heading">Edit tenant</CardTitle>
                <CardDescription>
                    Renaming is safe; changing the slug affects tenant URLs.
                </CardDescription>
            </CardHeader>
            <CardContent>
            <Form action={formAction} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="tenant-edit-name">Name</Label>
                    <Input
                        defaultValue={tenant.name}
                        id="tenant-edit-name"
                        maxLength={255}
                        name="name"
                        type="text"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="tenant-edit-slug">Slug</Label>
                    <Input
                        defaultValue={tenant.slug}
                        id="tenant-edit-slug"
                        maxLength={64}
                        name="slug"
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
                <Button disabled={pending} type="submit">
                    {pending ? 'Saving…' : 'Save changes'}
                </Button>
            </Form>
            </CardContent>
        </Card>
    )
}
