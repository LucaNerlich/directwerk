'use client'

import Form from 'next/form'
import {useActionState, useEffect, useRef} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Button} from '@directwerk/ui/components/button'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@directwerk/ui/components/card'
import {Input} from '@directwerk/ui/components/input'
import {Label} from '@directwerk/ui/components/label'

import type {TenantUploadLimits} from '@directwerk/api/types'

import {updateUploadLimitsAction} from '@/app/tenants/actions'
import {INITIAL_UPLOAD_LIMITS_STATE} from '@/app/tenants/actionState'

const MB = 1024 * 1024

/** Platform defaults in MB, shown as placeholders (backend MediaUploadRules). */
const DEFAULT_LIMIT_MB = {
    maxAudioBytes: 5120,
    maxImageBytes: 10,
    maxVideoBytes: 5120,
    maxDocumentBytes: 50,
} as const

type LimitField = keyof typeof DEFAULT_LIMIT_MB

const FIELDS: {name: LimitField; label: string}[] = [
    {name: 'maxAudioBytes', label: 'Audio'},
    {name: 'maxImageBytes', label: 'Images'},
    {name: 'maxVideoBytes', label: 'Video'},
    {name: 'maxDocumentBytes', label: 'Documents'},
]

function bytesToMegabytes(value: number | null | undefined): string {
    if (value === null || value === undefined) {
        return ''
    }
    return String(Math.round((value / MB) * 100) / 100)
}

interface TenantUploadLimitsFormProps {
    tenantId: string
    limits: TenantUploadLimits | null | undefined
    onSaved?: () => void
}

export default function TenantUploadLimitsForm({
    tenantId,
    limits,
    onSaved,
}: TenantUploadLimitsFormProps) {
    const [state, formAction, pending] = useActionState(
        updateUploadLimitsAction.bind(null, tenantId),
        INITIAL_UPLOAD_LIMITS_STATE
    )

    const handledState = useRef(state)
    useEffect(() => {
        if (state === handledState.current) {
            return
        }
        handledState.current = state
        if (state.error === null && state.limits !== null) {
            onSaved?.()
        }
    }, [state, onSaved])

    const formKey = FIELDS.map(
        (field) => bytesToMegabytes(limits?.[field.name]),
    ).join(':')

    return (
        <Card aria-labelledby="tenant-upload-limits-heading" role="region">
            <CardHeader>
                <CardTitle id="tenant-upload-limits-heading">Upload limits</CardTitle>
                <CardDescription>
                    Per-type caps in MB. Empty resets a type to the platform
                    default; the backend enforces these on upload.
                </CardDescription>
            </CardHeader>
            <CardContent>
            <Form action={formAction} className="space-y-4" key={formKey}>
                <div className="grid gap-4 sm:grid-cols-2">
                    {FIELDS.map((field) => (
                        <div className="space-y-2" key={field.name}>
                            <Label htmlFor={`tenant-limits-${field.name}`}>
                                {field.label} (MB)
                            </Label>
                            <Input
                                defaultValue={bytesToMegabytes(limits?.[field.name])}
                                id={`tenant-limits-${field.name}`}
                                inputMode="decimal"
                                max={5120}
                                min={1}
                                name={field.name}
                                placeholder={`Default: ${DEFAULT_LIMIT_MB[field.name]}`}
                                step="any"
                                type="number"
                            />
                        </div>
                    ))}
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
                    {pending ? 'Saving…' : 'Save limits'}
                </Button>
            </Form>
            </CardContent>
        </Card>
    )
}
