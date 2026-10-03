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
import {useDictionary, useLocale} from '@/lib/i18n/LocaleProvider'
import {localizedPath} from '@/lib/i18n/paths'
import {interpolate} from '@/lib/i18n/interpolate'

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
    const lang = useLocale()
    const {account, auth, common, errors} = useDictionary()
    const [cooldown, setCooldown] = useState(0)
    const emailRef = useRef<HTMLInputElement>(null)
    const [state, formAction, isPending] = useActionState(
        async (_previousState: ForgotPasswordState, formData: FormData) => {
            const email = String(formData.get('email') ?? '')
            const fieldErrors: AuthFieldErrors = {email: emailFieldError(email, auth)}
            if (hasFieldErrors(fieldErrors)) {
                return {...INITIAL_STATE, fieldErrors}
            }

            const input = parseForgotPasswordInput({email})
            if (input === null) {
                return {
                    ...INITIAL_STATE,
                    formError: auth.checkInputs,
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
                            : `${localizedPath(lang, '/reset-password')}?token=${encodeURIComponent(result.devResetToken)}`,
                }
            } catch (error) {
                return {
                    ...INITIAL_STATE,
                    formError: userFacingAuthError(error, 'forgot', errors),
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
        <AuthCard
            title={auth.forgotTitle}
            description={auth.forgotDescription}
            footer={
                <Link className="underline" href={localizedPath(lang, '/login')}>
                    {auth.forgotBackToLogin}
                </Link>
            }
        >
            <Form action={formAction} className="space-y-4" noValidate>
                <div className="space-y-2">
                    <Label htmlFor="email">{common.email}</Label>
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
                        ? auth.forgotPending
                        : cooldown > 0
                          ? interpolate(auth.forgotResendCooldown, {seconds: cooldown})
                          : state.success
                            ? auth.forgotResend
                            : auth.forgotSubmit}
                </Button>
                <p className="text-xs text-muted-foreground">
                    {auth.loginRateLimitHint}
                </p>
            </Form>
            {state.success && (
                <Alert role="status"><AlertDescription>
                    {auth.forgotSuccess}
                    {state.resetHref !== null && SHOW_DEV_RESET_LINK && (
                        <>
                            {' '}
                            <Link className="underline" href={state.resetHref}>{account.devResetLink}</Link>
                        </>
                    )}
                </AlertDescription></Alert>
            )}
        </AuthCard>
    )
}
