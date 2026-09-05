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

import {login, register} from '@/lib/api/client'
import {parseRegisterInput} from '@directwerk/api/validation/input'

import {setTokens} from '@/lib/auth/tokenStore'
import {safeReturnTo} from '@/lib/auth/safeReturnTo'
import {userFacingAuthError} from '@/lib/billing/userFacingBillingError'
import {getWebClientTenantHost} from '@/lib/tenant/clientHost'

interface RegisterState {
    error: string | null
}

const INITIAL_STATE: RegisterState = {error: null}

function RegisterForm() {
    const searchParams = useSearchParams()
    const returnTo = safeReturnTo(searchParams.get('returnTo'))
    const [showPassword, setShowPassword] = useState(false)
    const [state, formAction, isPending] = useActionState(
        async (_previousState: RegisterState, formData: FormData) => {
            const input = parseRegisterInput({
                email: formData.get('email'),
                password: formData.get('password'),
                name: formData.get('name') || undefined,
            })
            if (input === null) {
                return {
                    error:
                        'Bitte gültige E-Mail, ein Passwort mit mindestens 12 Zeichen und optional einen Namen eingeben.',
                }
            }

            try {
                const tenantHost = getWebClientTenantHost()
                await register(tenantHost, input)
                const tokens = await login(tenantHost, {
                    email: input.email,
                    password: input.password,
                })
                setTokens(tokens)
                window.location.assign(returnTo)
                return INITIAL_STATE
            } catch (error) {
                return {error: userFacingAuthError(error, 'register')}
            }
        },
        INITIAL_STATE,
    )

    return (
        <AuthCard
            title="Registrieren"
            description="Erstelle dein Konto für exklusive Inhalte."
            footer={
                <>
                    <span>Bereits registriert? </span>
                    <Link
                        className="underline"
                        href={
                            returnTo === '/account'
                                ? '/login'
                                : `/login?returnTo=${encodeURIComponent(returnTo)}`
                        }
                    >
                        Anmelden
                    </Link>
                </>
            }
        >
            <Form action={formAction} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="name">Name <span className="text-muted-foreground">(optional)</span></Label>
                    <Input id="name" name="name" type="text" autoComplete="name" maxLength={255} />
                </div>
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
                <Button className="w-full" type="submit" disabled={isPending}>
                    {isPending ? 'Registrierung läuft…' : 'Registrieren'}
                </Button>
                <p className="text-xs text-muted-foreground">
                    Aus Sicherheitsgründen sind wiederholte Versuche begrenzt — warte
                    bei einer Sperrung kurz und versuche es erneut.
                </p>
            </Form>
            {state.error !== null ? <Alert variant="destructive" role="alert"><AlertDescription>{state.error}</AlertDescription></Alert> : null}
        </AuthCard>
    )
}

export default function RegisterPage() {
    return (
        <Suspense
            fallback={
                <AuthCard
                    title="Registrieren"
                    description="Registrierung wird vorbereitet…"
                >
                    <p role="status" className="text-sm text-muted-foreground">Wird geladen…</p>
                </AuthCard>
            }
        >
            <RegisterForm />
        </Suspense>
    )
}
