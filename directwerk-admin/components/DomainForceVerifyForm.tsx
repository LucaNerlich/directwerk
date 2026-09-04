'use client'

import Form from 'next/form'
import {useActionState, useEffect, useRef} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Button} from '@directwerk/ui/components/button'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@directwerk/ui/components/card'
import {Input} from '@directwerk/ui/components/input'
import {Label} from '@directwerk/ui/components/label'

import {forceVerifyDomainAction} from '@/app/tenants/actions'
import {INITIAL_DOMAIN_VERIFY_STATE} from '@/app/tenants/actionState'

interface DomainForceVerifyFormProps {
    tenantId: string
    onVerified?: () => void
}

export default function DomainForceVerifyForm({
    tenantId,
    onVerified,
}: DomainForceVerifyFormProps) {
    const [state, formAction, pending] = useActionState(
        forceVerifyDomainAction.bind(null, tenantId),
        INITIAL_DOMAIN_VERIFY_STATE
    )

    // Refresh the parent (domains list) once per successful verification.
    const handledState = useRef(state)
    useEffect(() => {
        if (state === handledState.current) {
            return
        }
        handledState.current = state
        if (state.error === null && state.success !== null) {
            onVerified?.()
        }
    }, [state, onVerified])

    return (
        <Card aria-labelledby="domain-verify-heading" role="region">
            <CardHeader>
                <CardTitle id="domain-verify-heading">Force verify domain</CardTitle>
                <CardDescription>
                    Marks a tenant domain verified without DNS checks. Use
                    only after confirming ownership out of band.
                </CardDescription>
            </CardHeader>
            <CardContent>
            <Form action={formAction} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="domain-verify-host">Host</Label>
                    <Input
                        id="domain-verify-host"
                        name="host"
                        placeholder="tenant.example.com"
                        required
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
                    {pending ? 'Verifying…' : 'Force verify'}
                </Button>
            </Form>
            </CardContent>
        </Card>
    )
}
