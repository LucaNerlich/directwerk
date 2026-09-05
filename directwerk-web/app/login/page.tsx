'use client'

import Form from 'next/form'
import Link from 'next/link'
import {useSearchParams} from 'next/navigation'
import {Suspense, useActionState, useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import AuthCard from '@directwerk/ui/components/auth-card'
import {Button} from '@directwerk/ui/components/button'
import {Input} from '@directwerk/ui/components/input'
import {Label} from '@directwerk/ui/components/label'

import {login} from '@/lib/api/client'
import {parseLoginInput} from '@directwerk/api/validation/input'

import {setTokens} from '@/lib/auth/tokenStore'
import {safeReturnTo} from '@/lib/auth/safeReturnTo'
import {userFacingAuthError} from '@/lib/billing/userFacingBillingError'
import {getWebClientTenantHost} from '@/lib/tenant/clientHost'

interface LoginState {
    error: string | null
}

const INITIAL_STATE: LoginState = {error: null}

function LoginForm() {
    const searchParams = useSearchParams()
    const returnTo = safeReturnTo(searchParams.get('returnTo'))
    const showResetBanner = searchParams.get('reset') === '1'
    const showInvitedBanner = searchParams.get('invited') === '1'
    const [showPassword, setShowPassword] = useState(false)
    const [state, formAction, isPending] = useActionState(
        async (_previousState: LoginState, formData: FormData) => {
            const input = parseLoginInput({
                email: formData.get('email'),
                password: formData.get('password'),
            })
            if (input === null) {
                return {error: 'Bitte gültige E-Mail und ein Passwort mit mindestens 12 Zeichen eingeben.'}
            }

            try {
                const tokens = await login(getWebClientTenantHost(), input)
                setTokens(tokens)
                window.location.assign(returnTo)
                return INITIAL_STATE
            } catch (error) {
                return {error: userFacingAuthError(error, 'login')}
            }
        },
        INITIAL_STATE,
    )

    return (
        <AuthCard
            title="Anmelden"
            description="Melde dich an, um deine Inhalte und Mitgliedschaften zu verwalten."
            footer={
                <div className="space-y-2">
                    <p>
                        Noch kein Konto?{' '}
                        <Link
                            className="underline"
                            href={
                                returnTo === '/account'
                                    ? '/register'
                                    : `/register?returnTo=${encodeURIComponent(returnTo)}`
                            }
                        >
                            Registrieren
                        </Link>
                    </p>
                    <Link className="underline" href="/">Zur Startseite</Link>
                </div>
            }
        >
            {showResetBanner ? (
                <Alert role="status">
                    <AlertDescription>
                        Passwort aktualisiert. Melde dich jetzt mit deinem neuen Passwort an.
                    </AlertDescription>
                </Alert>
            ) : null}
            {showInvitedBanner ? (
                <Alert role="status">
                    <AlertDescription>
                        Einladung angenommen. Melde dich jetzt mit deinem Konto an.
                    </AlertDescription>
                </Alert>
            ) : null}
            <Form action={formAction} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="email">E-Mail</Label>
                    <Input id="email" name="email" type="email" autoComplete="username" maxLength={254} required />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="password">Passwort</Label>
                    <div className="relative">
                        <Input
                            id="password"
                            name="password"
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="current-password"
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
                </div>
                <Button className="w-full" type="submit" disabled={isPending}>
                    {isPending ? 'Anmeldung läuft…' : 'Anmelden'}
                </Button>
                <p className="text-xs text-muted-foreground">
                    Aus Sicherheitsgründen sind wiederholte Versuche begrenzt — warte
                    bei einer Sperrung kurz und versuche es erneut.
                </p>
            </Form>
            {state.error !== null ? <Alert variant="destructive" role="alert"><AlertDescription>{state.error}</AlertDescription></Alert> : null}
            <Link className="text-sm underline underline-offset-4" href="/forgot-password">Passwort vergessen?</Link>
        </AuthCard>
    )
}

export default function LoginPage() {
    return (
        <Suspense
            fallback={
                <AuthCard
                    title="Anmelden"
                    description="Anmeldung wird vorbereitet…"
                >
                    <p role="status" className="text-sm text-muted-foreground">Wird geladen…</p>
                </AuthCard>
            }
        >
            <LoginForm />
        </Suspense>
    )
}
