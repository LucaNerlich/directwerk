'use client'

import Form from 'next/form'
import Link from 'next/link'
import {useActionState, useEffect, useRef, useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import AuthCard from '@directwerk/ui/components/auth-card'
import {Button} from '@directwerk/ui/components/button'
import {Input} from '@directwerk/ui/components/input'
import {Label} from '@directwerk/ui/components/label'

import {forgotPassword} from '@/lib/api/client'
import {parseForgotPasswordInput} from '@directwerk/api/validation/input'
import {emailFieldError, hasFieldErrors} from '@/lib/forms/authFields'
import type {AuthFieldErrors} from '@/lib/forms/authFields'
import {useFocusFirstInvalidField} from '@/lib/forms/useFocusFirstInvalidField'
import {userFacingAuthError} from '@/lib/billing/userFacingBillingError'

interface ForgotPasswordState {
    formError: string | null
    fieldErrors: AuthFieldErrors
    success: boolean
    resetHref: string | null
}

const INITIAL_STATE: ForgotPasswordState = {
    formError: null,
    fieldErrors: {},
    success: false,
    resetHref: null,
}

const RESEND_COOLDOWN_SECONDS = 30
const SHOW_DEV_RESET_LINK = process.env.NODE_ENV !== 'production'

export default function ForgotPasswordPage() {
    const [cooldown, setCooldown] = useState(0)
    const emailRef = useRef<HTMLInputElement>(null)
    const [state, formAction, isPending] = useActionState(
        async (_previousState: ForgotPasswordState, formData: FormData) => {
            const email = String(formData.get('email') ?? '')
            const fieldErrors: AuthFieldErrors = {email: emailFieldError(email)}
            if (hasFieldErrors(fieldErrors)) {
                return {...INITIAL_STATE, fieldErrors}
            }

            const input = parseForgotPasswordInput({email})
            if (input === null) {
                return {
                    ...INITIAL_STATE,
                    formError: 'Bitte überprüfe deine Eingabe.',
                }
            }

            try {
                const result = await forgotPassword(input)
                setCooldown(RESEND_COOLDOWN_SECONDS)
                return {
                    formError: null,
                    fieldErrors: {},
                    success: true,
                    resetHref:
                        result.devResetToken === null
                            ? null
                            : `/reset-password?token=${encodeURIComponent(result.devResetToken)}`,
                }
            } catch (error) {
                return {
                    ...INITIAL_STATE,
                    formError: userFacingAuthError(error, 'forgot'),
                }
            }
        },
        INITIAL_STATE,
    )
    useFocusFirstInvalidField(state.fieldErrors, {email: emailRef})

    useEffect(() => {
        if (cooldown <= 0) {
            return
        }
        const timer = setTimeout(() => {
            setCooldown((current) => Math.max(0, current - 1))
        }, 1000)
        return () => {
            clearTimeout(timer)
        }
    }, [cooldown])

    const resendDisabled = isPending || cooldown > 0

    return (
        <AuthCard title="Passwort vergessen" description="Wir senden einen Link, wenn ein passendes Konto existiert." footer={<Link className="underline" href="/login">Zurück zur Anmeldung</Link>}>
            <Form action={formAction} className="space-y-4" noValidate>
                <div className="space-y-2">
                    <Label htmlFor="email">E-Mail</Label>
                    <Input
                        aria-describedby={state.fieldErrors.email !== undefined ? 'email-error' : undefined}
                        aria-invalid={state.fieldErrors.email !== undefined || undefined}
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
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
                {state.formError !== null ? (
                    <Alert variant="destructive" role="alert">
                        <AlertDescription>{state.formError}</AlertDescription>
                    </Alert>
                ) : null}
                <Button className="w-full" type="submit" disabled={resendDisabled}>
                    {isPending
                        ? 'Wird gesendet…'
                        : cooldown > 0
                          ? `Erneut senden (${cooldown} s)`
                          : state.success
                            ? 'Erneut senden'
                            : 'Reset-Link senden'}
                </Button>
                <p className="text-xs text-muted-foreground">
                    Aus Sicherheitsgründen sind wiederholte Versuche begrenzt — warte
                    bei einer Sperrung kurz und versuche es erneut.
                </p>
            </Form>
            {state.success && (
                <Alert role="status"><AlertDescription>
                    Falls die E-Mail registriert ist, ist der Link unterwegs.
                    {state.resetHref !== null && SHOW_DEV_RESET_LINK && (
                        <>
                            {' '}
                            <Link className="underline" href={state.resetHref}>Reset-Link öffnen (dev)</Link>
                        </>
                    )}
                </AlertDescription></Alert>
            )}
        </AuthCard>
    )
}
