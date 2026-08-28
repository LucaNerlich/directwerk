'use client'

import Form from 'next/form'
import Link from 'next/link'
import {useRouter, useSearchParams} from 'next/navigation'
import {useActionState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import AuthCard from '@directwerk/ui/components/auth-card'
import {Button} from '@directwerk/ui/components/button'
import {Input} from '@directwerk/ui/components/input'
import {Label} from '@directwerk/ui/components/label'

import {login} from '@/lib/api/client'
import {parseLoginInput} from '@directwerk/api/validation'
import {setTokens} from '@/lib/auth/tokenStore'
import {safeReturnTo} from '@/lib/auth/safeReturnTo'
import {getClientTenantHost} from '@/lib/tenant/getClientTenantHost'

interface LoginState {
    error: string | null
}

const INITIAL_STATE: LoginState = {error: null}

export default function LoginPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const returnTo = safeReturnTo(searchParams.get('returnTo'))
    const [state, formAction, isPending] = useActionState(
        async (_previousState: LoginState, formData: FormData) => {
            const input = parseLoginInput({
                email: formData.get('email'),
                password: formData.get('password'),
            })
            if (input === null) {
                return {error: 'Enter a valid email and a password of at least 12 characters.'}
            }

            try {
                const tokens = await login(getClientTenantHost(), input)
                setTokens(tokens)
                router.push(returnTo)
                return INITIAL_STATE
            } catch (error) {
                return {
                    error:
                        error instanceof Error
                            ? error.message
                            : 'Login failed. Please try again.',
                }
            }
        },
        INITIAL_STATE,
    )

    return (
        <AuthCard
            title="Anmelden"
            description="Melde dich an, um deine Inhalte und Mitgliedschaften zu verwalten."
            footer={
                <div className="space-y-2">
                    <p>
                        Noch kein Konto?{' '}
                        <Link
                            className="underline"
                            href={
                                returnTo === '/account'
                                    ? '/register'
                                    : `/register?returnTo=${encodeURIComponent(returnTo)}`
                            }
                        >
                            Registrieren
                        </Link>
                    </p>
                    <Link className="underline" href="/">Zur Startseite</Link>
                </div>
            }
        >
            <Form action={formAction} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="email">E-Mail</Label>
                    <Input id="email" name="email" type="email" autoComplete="email" maxLength={254} required />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="password">Passwort</Label>
                    <Input id="password" name="password" type="password" autoComplete="current-password" minLength={12} maxLength={128} required />
                </div>
                <Button className="w-full" type="submit" disabled={isPending}>
                    {isPending ? 'Anmeldung läuft…' : 'Anmelden'}
                </Button>
            </Form>
            {state.error !== null ? <Alert variant="destructive"><AlertDescription>{state.error}</AlertDescription></Alert> : null}
            <Link className="text-sm underline underline-offset-4" href="/forgot-password">Passwort vergessen?</Link>
        </AuthCard>
    )
}
