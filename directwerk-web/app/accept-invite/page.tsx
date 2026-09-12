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

import {acceptInvite} from '@/lib/api/client'
import {parseAcceptInviteInput} from '@directwerk/api/validation/input'
import {hasFieldErrors, nameFieldError, passwordFieldError, tokenFieldError} from '@/lib/forms/authFields'
import type {AuthFieldErrors} from '@/lib/forms/authFields'
import {useFocusFirstInvalidField} from '@/lib/forms/useFocusFirstInvalidField'
import {userFacingAuthError} from '@/lib/billing/userFacingBillingError'

interface AcceptInviteState {
    formError: string | null
    fieldErrors: AuthFieldErrors
    success: boolean
}

const INITIAL_STATE: AcceptInviteState = {
    formError: null,
    fieldErrors: {},
    success: false,
}

function AcceptInviteForm() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const tokenFromQuery = searchParams.get('token') ?? ''
    const [showPassword, setShowPassword] = useState(false)
    const tokenRef = useRef<HTMLInputElement>(null)
    const passwordRef = useRef<HTMLInputElement>(null)
    const nameRef = useRef<HTMLInputElement>(null)

    const [state, formAction, isPending] = useActionState(
        async (_previousState: AcceptInviteState, formData: FormData) => {
            const token = String(formData.get('token') ?? '')
            const password = String(formData.get('password') ?? '')
            const name = String(formData.get('name') ?? '')
            // A hidden link token cannot be corrected inline — surface a
            // form-level error instead of an unreachable field error.
            if (tokenFromQuery.length > 0 && token.trim().length === 0) {
                return {
                    ...INITIAL_STATE,
                    formError:
                        'Dieser Einladungslink ist ungültig oder abgelaufen. Bitte fordere eine neue Einladung an.',
                }
            }
            const fieldErrors: AuthFieldErrors = {
                token: tokenFromQuery.length > 0 ? undefined : tokenFieldError(token),
                password: passwordFieldError(password),
                name: nameFieldError(name),
            }
            if (hasFieldErrors(fieldErrors)) {
                return {...INITIAL_STATE, fieldErrors}
            }

            const input = parseAcceptInviteInput({
                token,
                password,
                name: name || undefined,
            })
            if (input === null) {
                return {
                    ...INITIAL_STATE,
                    formError: 'Bitte überprüfe deine Eingaben.',
                }
            }

            try {
                await acceptInvite(input)
                router.push('/login?invited=1')
                return {formError: null, fieldErrors: {}, success: true}
            } catch (error) {
                return {
                    ...INITIAL_STATE,
                    formError: userFacingAuthError(error, 'invite'),
                }
            }
        },
        INITIAL_STATE,
    )
    useFocusFirstInvalidField(state.fieldErrors, {
        token: tokenRef,
        password: passwordRef,
        name: nameRef,
    })

    return (
        <>
            <Form action={formAction} className="space-y-4" noValidate>
                {tokenFromQuery.length > 0 ? (
                    <input type="hidden" name="token" value={tokenFromQuery} />
                ) : (
                    <div className="space-y-2">
                        <Label htmlFor="token">Einladungs-Token</Label>
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
                    <Label htmlFor="name">Name <span className="text-muted-foreground">(optional)</span></Label>
                    <Input
                        aria-describedby={state.fieldErrors.name !== undefined ? 'name-error' : undefined}
                        aria-invalid={state.fieldErrors.name !== undefined || undefined}
                        id="name"
                        name="name"
                        type="text"
                        autoComplete="name"
                        maxLength={255}
                        ref={nameRef}
                    />
                    {state.fieldErrors.name !== undefined ? (
                        <p className="text-xs text-destructive" id="name-error">
                            {state.fieldErrors.name}
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
                <Button className="w-full" type="submit" disabled={isPending || state.success}>
                    {isPending ? 'Wird angenommen…' : 'Einladung annehmen'}
                </Button>
                <p className="text-xs text-muted-foreground">
                    Aus Sicherheitsgründen sind wiederholte Versuche begrenzt — warte
                    bei einer Sperrung kurz und versuche es erneut.
                </p>
            </Form>
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
