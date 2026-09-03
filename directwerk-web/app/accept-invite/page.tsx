'use client'

import Form from 'next/form'
import Link from 'next/link'
import {useRouter, useSearchParams} from 'next/navigation'
import {Suspense, useActionState, useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import AuthCard from '@directwerk/ui/components/auth-card'
import {Button} from '@directwerk/ui/components/button'
import {Input} from '@directwerk/ui/components/input'
import {Label} from '@directwerk/ui/components/label'

import {acceptInvite} from '@/lib/api/client'
import {parseAcceptInviteInput} from '@directwerk/api/validation/input'
import {userFacingAuthError} from '@/lib/billing/userFacingBillingError'

interface AcceptInviteState {
    error: string | null
    success: boolean
}

const INITIAL_STATE: AcceptInviteState = {error: null, success: false}

function AcceptInviteForm() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const tokenFromQuery = searchParams.get('token') ?? ''
    const [showPassword, setShowPassword] = useState(false)

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
                        'Bitte gib das Einladungs-Token, ein Passwort mit mindestens 12 Zeichen und optional einen Namen ein.',
                    success: false,
                }
            }

            try {
                await acceptInvite(input)
                router.push('/login?invited=1')
                return {error: null, success: true}
            } catch (error) {
                return {
                    error: userFacingAuthError(error, 'invite'),
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
                <div className="space-y-2">
                    <Label htmlFor="password">Passwort</Label>
                    <div className="relative">
                        <Input
                            id="password"
                            name="password"
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="new-password"
                            minLength={12}
                            maxLength={128}
                            required
                            className="pr-24"
                        />
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute top-1/2 right-1 -translate-y-1/2"
                            aria-pressed={showPassword}
                            onClick={() => setShowPassword((current) => !current)}
                        >
                            {showPassword ? 'Verbergen' : 'Anzeigen'}
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Mindestens 12 Zeichen.</p>
                </div>
                <Button className="w-full" type="submit" disabled={isPending || state.success}>
                    {isPending ? 'Wird angenommen…' : 'Einladung annehmen'}
                </Button>
                <p className="text-xs text-muted-foreground">
                    Aus Sicherheitsgründen sind wiederholte Versuche begrenzt — warte
                    bei einer Sperrung kurz und versuche es erneut.
                </p>
            </Form>
            {state.error !== null ? <Alert variant="destructive" role="alert"><AlertDescription>{state.error}</AlertDescription></Alert> : null}
            {state.success && (
                <Alert role="status"><AlertDescription>Einladung angenommen. Weiterleitung…</AlertDescription></Alert>
            )}
        </>
    )
}

export default function AcceptInvitePage() {
    return (
        <AuthCard title="Einladung annehmen" footer={<Link className="underline" href="/login">Zur Anmeldung</Link>}>
            <Suspense fallback={<p role="status" className="text-sm text-muted-foreground">Wird geladen…</p>}>
                <AcceptInviteForm />
            </Suspense>
        </AuthCard>
    )
}
