'use client'

import Form from 'next/form'
import Link from 'next/link'
import {useActionState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import AuthCard from '@directwerk/ui/components/auth-card'
import {Button} from '@directwerk/ui/components/button'
import {Input} from '@directwerk/ui/components/input'
import {Label} from '@directwerk/ui/components/label'

import {forgotPassword} from '@/lib/api/client'
import {parseForgotPasswordInput} from '@directwerk/api/validation/input'

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

export default function ForgotPasswordPage() {
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
                    error:
                        error instanceof Error
                            ? error.message
                            : 'Passwort-Reset konnte nicht gestartet werden. Bitte erneut versuchen.',
                    success: false,
                    resetHref: null,
                }
            }
        },
        INITIAL_STATE,
    )

    return (
        <AuthCard title="Passwort vergessen" description="Wir senden einen Link, wenn ein passendes Konto existiert." footer={<Link className="underline" href="/login">Zurück zur Anmeldung</Link>}>
            <Form action={formAction} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="email">E-Mail</Label>
                    <Input id="email" name="email" type="email" autoComplete="email" maxLength={254} required />
                </div>
                <Button className="w-full" type="submit" disabled={isPending || state.success}>
                    {isPending ? 'Wird gesendet…' : 'Reset-Link senden'}
                </Button>
            </Form>
            {state.error !== null ? <Alert variant="destructive"><AlertDescription>{state.error}</AlertDescription></Alert> : null}
            {state.success && (
                <Alert role="status"><AlertDescription>
                    Falls die E-Mail registriert ist, ist der Link unterwegs.
                    {state.resetHref !== null && (
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
