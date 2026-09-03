'use client'

import Form from 'next/form'
import Link from 'next/link'
import {useActionState, useEffect, useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import AuthCard from '@directwerk/ui/components/auth-card'
import {Button} from '@directwerk/ui/components/button'
import {Input} from '@directwerk/ui/components/input'
import {Label} from '@directwerk/ui/components/label'

import {forgotPassword} from '@/lib/api/client'
import {parseForgotPasswordInput} from '@directwerk/api/validation/input'
import {userFacingAuthError} from '@/lib/billing/userFacingBillingError'

interface ForgotPasswordState {
    error: string | null
    success: boolean
    resetHref: string | null
}

const INITIAL_STATE: ForgotPasswordState = {
    error: null,
    success: false,
    resetHref: null,
}

const RESEND_COOLDOWN_SECONDS = 30
const SHOW_DEV_RESET_LINK = process.env.NODE_ENV !== 'production'

export default function ForgotPasswordPage() {
    const [cooldown, setCooldown] = useState(0)
    const [state, formAction, isPending] = useActionState(
        async (_previousState: ForgotPasswordState, formData: FormData) => {
            const input = parseForgotPasswordInput({
                email: formData.get('email'),
            })
            if (input === null) {
                return {
                    error: 'Bitte eine gültige E-Mail-Adresse eingeben.',
                    success: false,
                    resetHref: null,
                }
            }

            try {
                const result = await forgotPassword(input)
                setCooldown(RESEND_COOLDOWN_SECONDS)
                return {
                    error: null,
                    success: true,
                    resetHref:
                        result.devResetToken === null
                            ? null
                            : `/reset-password?token=${encodeURIComponent(result.devResetToken)}`,
                }
            } catch (error) {
                return {
                    error: userFacingAuthError(error, 'forgot'),
                    success: false,
                    resetHref: null,
                }
            }
        },
        INITIAL_STATE,
    )

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
            <Form action={formAction} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="email">E-Mail</Label>
                    <Input id="email" name="email" type="email" autoComplete="email" maxLength={254} required />
                </div>
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
            {state.error !== null ? <Alert variant="destructive" role="alert"><AlertDescription>{state.error}</AlertDescription></Alert> : null}
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
