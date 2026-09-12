'use client'

import Form from 'next/form'
import Link from 'next/link'
import {useRouter, useSearchParams} from 'next/navigation'
import {Suspense, useActionState, useRef, useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import AuthCard from '@directwerk/ui/components/auth-card'
import {Button} from '@directwerk/ui/components/button'
import {Input} from '@directwerk/ui/components/input'
import {Label} from '@directwerk/ui/components/label'

import {resetPassword} from '@/lib/api/client'
import {parseResetPasswordInput} from '@directwerk/api/validation/input'
import {hasFieldErrors, passwordFieldError, tokenFieldError} from '@/lib/forms/authFields'
import type {AuthFieldErrors} from '@/lib/forms/authFields'
import {useFocusFirstInvalidField} from '@/lib/forms/useFocusFirstInvalidField'
import {userFacingAuthError} from '@/lib/billing/userFacingBillingError'

interface ResetPasswordState {
    formError: string | null
    fieldErrors: AuthFieldErrors
    success: boolean
}

const INITIAL_STATE: ResetPasswordState = {
    formError: null,
    fieldErrors: {},
    success: false,
}

function ResetPasswordForm() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const tokenFromQuery = searchParams.get('token') ?? ''
    const [showPassword, setShowPassword] = useState(false)
    const tokenRef = useRef<HTMLInputElement>(null)
    const passwordRef = useRef<HTMLInputElement>(null)

    const [state, formAction, isPending] = useActionState(
        async (_previousState: ResetPasswordState, formData: FormData) => {
            const token = String(formData.get('token') ?? '')
            const newPassword = String(formData.get('newPassword') ?? '')
            // A hidden link token cannot be corrected inline — surface a
            // form-level error instead of an unreachable field error.
            if (tokenFromQuery.length > 0 && token.trim().length === 0) {
                return {
                    ...INITIAL_STATE,
                    formError:
                        'Dieser Reset-Link ist ungültig oder abgelaufen. Bitte fordere einen neuen an.',
                }
            }
            const fieldErrors: AuthFieldErrors = {
                token: tokenFromQuery.length > 0 ? undefined : tokenFieldError(token),
                password: passwordFieldError(newPassword),
            }
            if (hasFieldErrors(fieldErrors)) {
                return {...INITIAL_STATE, fieldErrors}
            }

            const input = parseResetPasswordInput({token, newPassword})
            if (input === null) {
                return {
                    ...INITIAL_STATE,
                    formError: 'Bitte überprüfe deine Eingaben.',
                }
            }

            try {
                await resetPassword(input)
                router.push('/login?reset=1')
                return {formError: null, fieldErrors: {}, success: true}
            } catch (error) {
                return {
                    ...INITIAL_STATE,
                    formError: userFacingAuthError(error, 'reset'),
                }
            }
        },
        INITIAL_STATE,
    )
    useFocusFirstInvalidField(state.fieldErrors, {
        token: tokenRef,
        password: passwordRef,
    })

    return (
        <>
            <Form action={formAction} className="space-y-4" noValidate>
                {tokenFromQuery.length > 0 ? (
                    <input type="hidden" name="token" value={tokenFromQuery} />
                ) : (
                    <div className="space-y-2">
                        <Label htmlFor="token">Reset-Token</Label>
                        <Input
                            aria-describedby={state.fieldErrors.token !== undefined ? 'token-error' : undefined}
                            aria-invalid={state.fieldErrors.token !== undefined || undefined}
                            id="token"
                            name="token"
                            type="text"
                            autoComplete="off"
                            maxLength={512}
                            ref={tokenRef}
                            required
                        />
                        {state.fieldErrors.token !== undefined ? (
                            <p className="text-xs text-destructive" id="token-error">
                                {state.fieldErrors.token}
                            </p>
                        ) : null}
                    </div>
                )}
                <div className="space-y-2">
                    <Label htmlFor="newPassword">Neues Passwort</Label>
                    <div className="relative">
                        <Input
                            aria-describedby={state.fieldErrors.password !== undefined ? 'password-error' : undefined}
                            aria-invalid={state.fieldErrors.password !== undefined || undefined}
                            id="newPassword"
                            name="newPassword"
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
                <Button className="w-full" type="submit" disabled={isPending || state.success}>
                    {isPending ? 'Wird gespeichert…' : 'Passwort festlegen'}
                </Button>
                <p className="text-xs text-muted-foreground">
                    Aus Sicherheitsgründen sind wiederholte Versuche begrenzt — warte
                    bei einer Sperrung kurz und versuche es erneut.
                </p>
            </Form>
            {state.success && (
                <Alert role="status"><AlertDescription>Passwort aktualisiert. Weiterleitung…</AlertDescription></Alert>
            )}
        </>
    )
}

export default function ResetPasswordPage() {
    return (
        <AuthCard title="Passwort zurücksetzen" footer={<><Link className="underline" href="/login">Zur Anmeldung</Link><span> · </span><Link className="underline" href="/forgot-password">Neuen Link anfordern</Link></>}>
            <Suspense fallback={<p role="status" className="text-sm text-muted-foreground">Wird geladen…</p>}>
                <ResetPasswordForm />
            </Suspense>
        </AuthCard>
    )
}
