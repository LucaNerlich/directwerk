'use client'

import Form from 'next/form'
import {useActionState} from 'react'

import {Alert, AlertDescription} from '@publish/ui/components/alert'
import {Button} from '@publish/ui/components/button'
import {Card, CardContent, CardHeader, CardTitle} from '@publish/ui/components/card'
import {Input} from '@publish/ui/components/input'
import {Label} from '@publish/ui/components/label'

import {patchPlatformData} from '@/lib/api/client'
import {AUTH_REQUIRED, CONFLICT, REQUEST_FAILED} from '@/lib/api/errors'
import type {Tenant} from '@/lib/api/types'

interface TenantEditFormProps {
    tenantId: string
    tenant: Tenant
    onUpdated?: (tenant: Tenant) => void
}

interface TenantEditState {
    error: string | null
    success: string | null
}

const INITIAL_STATE: TenantEditState = {error: null, success: null}

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/

/**
 * Renders a form for updating a tenant's name or slug.
 *
 * @param tenantId - The identifier of the tenant to update
 * @param tenant - The tenant whose current values populate the form
 * @param onUpdated - Optional callback invoked with the updated tenant
 */
export default function TenantEditForm({
    tenantId,
    tenant,
    onUpdated,
}: TenantEditFormProps) {
    async function updateAction(
        _previousState: TenantEditState,
        formData: FormData
    ): Promise<TenantEditState> {
        const name = String(formData.get('name') ?? '').trim()
        const slug = String(formData.get('slug') ?? '').trim()

        if (name.length === 0 && slug.length === 0) {
            return {...INITIAL_STATE, error: 'Enter a name or slug to update.'}
        }
        if (slug.length > 0 && !SLUG_PATTERN.test(slug)) {
            return {
                ...INITIAL_STATE,
                error: 'Slug must be lowercase letters, numbers, and hyphens.',
            }
        }

        try {
            const updated = await patchPlatformData<Tenant>(`tenants/${tenantId}`, {
                name: name.length > 0 ? name : undefined,
                slug: slug.length > 0 ? slug : undefined,
            })
            onUpdated?.(updated)
            return {error: null, success: 'Tenant updated.'}
        } catch (requestError: unknown) {
            if (
                requestError instanceof Error &&
                requestError.message === AUTH_REQUIRED
            ) {
                return {...INITIAL_STATE, error: 'Your session expired. Sign in again.'}
            }
            if (
                requestError instanceof Error &&
                requestError.message === CONFLICT
            ) {
                return {...INITIAL_STATE, error: 'That slug is already in use.'}
            }
            if (
                requestError instanceof Error &&
                requestError.message === REQUEST_FAILED
            ) {
                return {
                    ...INITIAL_STATE,
                    error: 'Update failed. Check the details and try again.',
                }
            }
            return {...INITIAL_STATE, error: 'Update is unavailable. Try again later.'}
        }
    }

    const [state, formAction, pending] = useActionState(updateAction, INITIAL_STATE)

    return (
        <Card aria-labelledby="tenant-edit-heading" role="region">
            <CardHeader><CardTitle id="tenant-edit-heading">Edit tenant</CardTitle></CardHeader>
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
