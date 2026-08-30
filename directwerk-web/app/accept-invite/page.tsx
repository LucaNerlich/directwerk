'use client'

import Form from 'next/form'
import Link from 'next/link'
import {useSearchParams} from 'next/navigation'
import {Suspense, useActionState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import AuthCard from '@directwerk/ui/components/auth-card'
import {Button} from '@directwerk/ui/components/button'
import {Input} from '@directwerk/ui/components/input'
import {Label} from '@directwerk/ui/components/label'

import {acceptInvite} from '@/lib/api/client'
import {parseAcceptInviteInput} from '@directwerk/api/validation/input'

interface AcceptInviteState {
    error: string | null
    success: boolean
}

const INITIAL_STATE: AcceptInviteState = {error: null, success: false}

function AcceptInviteForm() {
    const searchParams = useSearchParams()
    const tokenFromQuery = searchParams.get('token') ?? ''

    const [state, formAction, isPending] = useActionState(
        async (_previousState: AcceptInviteState, formData: FormData) => {
            const input = parseAcceptInviteInput({
                token: formData.get('token'),
                password: formData.get('password'),
                name: formData.get('name') || undefined,
            })
            if (input === null) {
                return {
                    error:
                        'Enter the invite token, a password of at least 12 characters, and an optional name.',
                    success: false,
                }
            }

            try {
                await acceptInvite(input)
                window.location.assign('/login')
                return {error: null, success: true}
            } catch (error) {
                return {
                    error:
                        error instanceof Error
                            ? error.message
                            : 'Could not accept the invitation. Please try again.',
                    success: false,
                }
            }
        },
        INITIAL_STATE,
    )

    return (
        <>
            <Form action={formAction} className="space-y-4">
                {tokenFromQuery.length > 0 ? (
                    <input type="hidden" name="token" value={tokenFromQuery} />
                ) : (
                    <div className="space-y-2"><Label htmlFor="token">Einladungs-Token</Label><Input id="token" name="token" type="text" autoComplete="off" maxLength={512} required /></div>
                )}
                <div className="space-y-2"><Label htmlFor="name">Name <span className="text-muted-foreground">(optional)</span></Label><Input id="name" name="name" type="text" autoComplete="name" maxLength={255} /></div>
                <div className="space-y-2"><Label htmlFor="password">Passwort</Label><Input id="password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></div>
                <Button className="w-full" type="submit" disabled={isPending || state.success}>
                    {isPending ? 'Wird angenommen…' : 'Einladung annehmen'}
                </Button>
            </Form>
            {state.error !== null ? <Alert variant="destructive"><AlertDescription>{state.error}</AlertDescription></Alert> : null}
            {state.success && (
                <Alert role="status"><AlertDescription>Einladung angenommen. Weiterleitung…</AlertDescription></Alert>
            )}
        </>
    )
}

export default function AcceptInvitePage() {
    return (
        <AuthCard title="Einladung annehmen" footer={<Link className="underline" href="/login">Zur Anmeldung</Link>}>
            <Suspense fallback={<p>Loading…</p>}>
                <AcceptInviteForm />
            </Suspense>
        </AuthCard>
    )
}
