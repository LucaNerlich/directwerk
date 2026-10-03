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
import {useDictionary, useLocale} from '@/lib/i18n/LocaleProvider'
import {localizedPath} from '@/lib/i18n/paths'

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
    const lang = useLocale()
    const {auth, common, errors} = useDictionary()
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
                    formError: auth.resetInvalid,
                }
            }
            const fieldErrors: AuthFieldErrors = {
                token: tokenFromQuery.length > 0 ? undefined : tokenFieldError(token, auth),
                password: passwordFieldError(newPassword, auth),
            }
            if (hasFieldErrors(fieldErrors)) {
                return {...INITIAL_STATE, fieldErrors}
            }

            const input = parseResetPasswordInput({token, newPassword})
            if (input === null) {
                return {
                    ...INITIAL_STATE,
                    formError: auth.checkInputs,
                }
            }

            try {
                await resetPassword(input)
                router.push(`${localizedPath(lang, '/login')}?reset=1`)
                return {formError: null, fieldErrors: {}, success: true}
            } catch (error) {
                return {
                    ...INITIAL_STATE,
                    formError: userFacingAuthError(error, 'reset', errors),
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
                        <Label htmlFor="token">{auth.resetTokenLabel}</Label>
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
                    <Label htmlFor="newPassword">{auth.newPasswordLabel}</Label>
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
                            {showPassword ? common.hidePassword : common.showPassword}
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">{auth.passwordHint}</p>
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
                    {isPending ? auth.resetPending : auth.resetSubmit}
                </Button>
                <p className="text-xs text-muted-foreground">
                    {auth.loginRateLimitHint}
                </p>
            </Form>
            {state.success && (
                <Alert role="status"><AlertDescription>{auth.resetRedirecting}</AlertDescription></Alert>
            )}
        </>
    )
}

export default function ResetPasswordPage() {
    const lang = useLocale()
    const {auth, common} = useDictionary()
    return (
        <AuthCard
            title={auth.resetTitle}
            footer={
                <>
                    <Link className="underline" href={localizedPath(lang, '/login')}>
                        {auth.resetToLogin}
                    </Link>
                    <span> · </span>
                    <Link className="underline" href={localizedPath(lang, '/forgot-password')}>
                        {auth.resetRequestNew}
                    </Link>
                </>
            }
        >
            <Suspense fallback={<p role="status" className="text-sm text-muted-foreground">{common.loading}</p>}>
                <ResetPasswordForm />
            </Suspense>
        </AuthCard>
    )
}
