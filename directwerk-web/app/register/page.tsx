'use client'

import Form from 'next/form'
import Link from 'next/link'
import {useSearchParams} from 'next/navigation'
import {Suspense, useActionState, useRef, useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import AuthCard from '@directwerk/ui/components/auth-card'
import {Button} from '@directwerk/ui/components/button'
import {Input} from '@directwerk/ui/components/input'
import {Label} from '@directwerk/ui/components/label'

import {login, register} from '@/lib/api/client'
import {parseRegisterInput} from '@directwerk/api/validation/input'
import {emailFieldError, hasFieldErrors, passwordFieldError} from '@/lib/forms/authFields'
import type {AuthFieldErrors} from '@/lib/forms/authFields'
import {useFocusFirstInvalidField} from '@/lib/forms/useFocusFirstInvalidField'

import {setTokens} from '@/lib/auth/tokenStore'
import {safeReturnTo} from '@/lib/auth/safeReturnTo'
import {userFacingAuthError} from '@/lib/billing/userFacingBillingError'
import {getWebClientTenantHost} from '@/lib/tenant/clientHost'

interface RegisterState {
    formError: string | null
    fieldErrors: AuthFieldErrors
}

const INITIAL_STATE: RegisterState = {formError: null, fieldErrors: {}}

function RegisterForm() {
    const searchParams = useSearchParams()
    const returnTo = safeReturnTo(searchParams.get('returnTo'))
    const [showPassword, setShowPassword] = useState(false)
    const emailRef = useRef<HTMLInputElement>(null)
    const passwordRef = useRef<HTMLInputElement>(null)
    const [state, formAction, isPending] = useActionState(
        async (_previousState: RegisterState, formData: FormData) => {
            const name = formData.get('name')
            const email = String(formData.get('email') ?? '')
            const password = String(formData.get('password') ?? '')
            const fieldErrors: AuthFieldErrors = {
                email: emailFieldError(email),
                password: passwordFieldError(password),
            }
            if (hasFieldErrors(fieldErrors)) {
                return {formError: null, fieldErrors}
            }

            const input = parseRegisterInput({
                email,
                password,
                name: name || undefined,
            })
            if (input === null) {
                return {
                    formError: 'Bitte überprüfe deine Eingaben.',
                    fieldErrors: {},
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
                return {
                    formError: userFacingAuthError(error, 'register'),
                    fieldErrors: {},
                }
            }
        },
        INITIAL_STATE,
    )
    useFocusFirstInvalidField(state.fieldErrors, {
        email: emailRef,
        password: passwordRef,
    })

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
            <Form action={formAction} className="space-y-4" noValidate>
                <div className="space-y-2">
                    <Label htmlFor="name">Name <span className="text-muted-foreground">(optional)</span></Label>
                    <Input id="name" name="name" type="text" autoComplete="name" maxLength={255} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="email">E-Mail</Label>
                    <Input
                        aria-describedby={state.fieldErrors.email !== undefined ? 'email-error' : undefined}
                        aria-invalid={state.fieldErrors.email !== undefined || undefined}
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="username"
                        maxLength={254}
                        ref={emailRef}
                        required
                        spellCheck={false}
                    />
                    {state.fieldErrors.email !== undefined ? (
                        <p className="text-xs text-destructive" id="email-error">
                            {state.fieldErrors.email}
                        </p>
                    ) : null}
                </div>
                <div className="space-y-2">
                    <Label htmlFor="password">Passwort</Label>
                    <div className="relative">
                        <Input
                            aria-describedby={state.fieldErrors.password !== undefined ? 'password-error' : undefined}
                            aria-invalid={state.fieldErrors.password !== undefined || undefined}
                            id="password"
                            name="password"
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="new-password"
                            minLength={12}
                            maxLength={128}
                            ref={passwordRef}
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
                    {state.fieldErrors.password !== undefined ? (
                        <p className="text-xs text-destructive" id="password-error">
                            {state.fieldErrors.password}
                        </p>
                    ) : null}
                </div>
                {state.formError !== null ? (
                    <Alert variant="destructive" role="alert">
                        <AlertDescription>{state.formError}</AlertDescription>
                    </Alert>
                ) : null}
                <Button className="w-full" type="submit" disabled={isPending}>
                    {isPending ? 'Registrierung läuft…' : 'Registrieren'}
                </Button>
                <p className="text-xs text-muted-foreground">
                    Aus Sicherheitsgründen sind wiederholte Versuche begrenzt — warte
                    bei einer Sperrung kurz und versuche es erneut.
                </p>
            </Form>
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
