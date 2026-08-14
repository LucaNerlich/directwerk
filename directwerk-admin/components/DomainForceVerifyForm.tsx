'use client'

import Form from 'next/form'
import {useActionState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Button} from '@directwerk/ui/components/button'
import {Card, CardContent, CardHeader, CardTitle} from '@directwerk/ui/components/card'
import {Input} from '@directwerk/ui/components/input'
import {Label} from '@directwerk/ui/components/label'

import {postPlatformData} from '@/lib/api/client'
import {AUTH_REQUIRED} from '@/lib/api/errors'

interface DomainForceVerifyFormProps {
    tenantId: string
}

interface DomainVerifyState {
    error: string | null
    success: string | null
}

const INITIAL_STATE: DomainVerifyState = {error: null, success: null}

/**
 * Renders a form for force-verifying a tenant domain.
 *
 * @param tenantId - The tenant whose domain should be verified
 * @returns The domain verification form
 */
export default function DomainForceVerifyForm({
    tenantId,
}: DomainForceVerifyFormProps) {
    async function verifyAction(
        _previousState: DomainVerifyState,
        formData: FormData
    ): Promise<DomainVerifyState> {
        const host = String(formData.get('host') ?? '').trim()
        if (host.length === 0) {
            return {...INITIAL_STATE, error: 'Enter a domain host.'}
        }

        if (
            host.includes('/') ||
            host === '.' ||
            host === '..' ||
            host.startsWith('.') ||
            host.endsWith('.')
        ) {
            return {...INITIAL_STATE, error: 'Enter a valid domain host.'}
        }

        try {
            await postPlatformData(
                `tenants/${tenantId}/domains/${host}/verify`,
                {}
            )
            return {error: null, success: `${host} force-verified.`}
        } catch (requestError: unknown) {
            if (
                requestError instanceof Error &&
                requestError.message === AUTH_REQUIRED
            ) {
                return {...INITIAL_STATE, error: 'Your session expired. Sign in again.'}
            }
            return {
                ...INITIAL_STATE,
                error: 'Force verify failed. Check the host and try again.',
            }
        }
    }

    const [state, formAction, pending] = useActionState(verifyAction, INITIAL_STATE)

    return (
        <Card aria-labelledby="domain-verify-heading" role="region">
            <CardHeader><CardTitle id="domain-verify-heading">Force verify domain</CardTitle></CardHeader>
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
