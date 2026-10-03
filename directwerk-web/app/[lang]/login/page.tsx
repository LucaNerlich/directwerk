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

import {login} from '@/lib/api/client'
import {parseLoginInput} from '@directwerk/api/validation/input'
import {emailFieldError, hasFieldErrors, passwordFieldError} from '@/lib/forms/authFields'
import type {AuthFieldErrors} from '@/lib/forms/authFields'
import {useFocusFirstInvalidField} from '@/lib/forms/useFocusFirstInvalidField'

import {setTokens} from '@/lib/auth/tokenStore'
import {invalidatePendingRefresh} from '@/lib/auth/session'
import {safeReturnTo} from '@/lib/auth/safeReturnTo'
import {userFacingAuthError} from '@/lib/billing/userFacingBillingError'
import {useDictionary, useLocale} from '@/lib/i18n/LocaleProvider'
import {localizedPath} from '@/lib/i18n/paths'
import {getWebClientTenantHost} from '@/lib/tenant/clientHost'

interface LoginState {
    formError: string | null
    fieldErrors: AuthFieldErrors
}

const INITIAL_STATE: LoginState = {formError: null, fieldErrors: {}}

function LoginForm() {
    const lang = useLocale()
    const {auth, common, errors, nav} = useDictionary()
    const searchParams = useSearchParams()
    const returnTo = safeReturnTo(searchParams.get('returnTo'), '/account', lang)
    const showResetBanner = searchParams.get('reset') === '1'
    const showInvitedBanner = searchParams.get('invited') === '1'
    const [showPassword, setShowPassword] = useState(false)
    const emailRef = useRef<HTMLInputElement>(null)
    const passwordRef = useRef<HTMLInputElement>(null)
    const [state, formAction, isPending] = useActionState(
        async (_previousState: LoginState, formData: FormData) => {
            const email = String(formData.get('email') ?? '')
            const password = String(formData.get('password') ?? '')
            const fieldErrors: AuthFieldErrors = {
                email: emailFieldError(email, auth),
                password: passwordFieldError(password, auth),
            }
            if (hasFieldErrors(fieldErrors)) {
                return {formError: null, fieldErrors}
            }

            const input = parseLoginInput(
                {email, password},
                {normalizeEmail: true},
            )
            if (input === null) {
                return {
                    formError: auth.checkInputs,
                    fieldErrors: {},
                }
            }

            try {
                const tokens = await login(getWebClientTenantHost(), input)
                // Drop any refresh started under the previous identity before
                // storing the new session's tokens.
                invalidatePendingRefresh()
                setTokens(tokens)
                window.location.assign(returnTo)
                return INITIAL_STATE
            } catch (error) {
                return {
                    formError: userFacingAuthError(error, 'login', errors),
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
            title={auth.loginTitle}
            description={auth.loginDescription}
            footer={
                <div className="space-y-2">
                    <p>
                        {auth.noAccountYet}{' '}
                        <Link
                            className="underline"
                            href={
                                returnTo === localizedPath(lang, '/account')
                                    ? localizedPath(lang, '/register')
                                    : `${localizedPath(lang, '/register')}?returnTo=${encodeURIComponent(returnTo)}`
                            }
                        >
                            {nav.register}
                        </Link>
                    </p>
                    <Link className="underline" href={localizedPath(lang, '/')}>{nav.toHome}</Link>
                </div>
            }
        >
            {showResetBanner ? (
                <Alert role="status">
                    <AlertDescription>
                        {auth.passwordUpdatedBanner}
                    </AlertDescription>
                </Alert>
            ) : null}
            {showInvitedBanner ? (
                <Alert role="status">
                    <AlertDescription>
                        {auth.inviteAcceptedBanner}
                    </AlertDescription>
                </Alert>
            ) : null}
            <Form action={formAction} className="space-y-4" noValidate>
                <div className="space-y-2">
                    <Label htmlFor="email">{common.email}</Label>
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
                    <Label htmlFor="password">{common.password}</Label>
                    <div className="relative">
                        <Input
                            aria-describedby={state.fieldErrors.password !== undefined ? 'password-error' : undefined}
                            aria-invalid={state.fieldErrors.password !== undefined || undefined}
                            id="password"
                            name="password"
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="current-password"
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
                    {isPending ? auth.loginPending : auth.loginTitle}
                </Button>
                <p className="text-xs text-muted-foreground">
                    {auth.loginRateLimitHint}
                </p>
            </Form>
            <Link className="text-sm underline underline-offset-4" href={localizedPath(lang, '/forgot-password')}>{auth.forgotPasswordLink}</Link>
        </AuthCard>
    )
}

export default function LoginPage() {
    const {auth, common} = useDictionary()
    return (
        <Suspense
            fallback={
                <AuthCard
                    title={auth.loginTitle}
                    description={auth.loginPreparing}
                >
                    <p role="status" className="text-sm text-muted-foreground">{common.loading}</p>
                </AuthCard>
            }
        >
            <LoginForm />
        </Suspense>
    )
}
