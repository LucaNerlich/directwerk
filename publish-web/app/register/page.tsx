'use client'

import Form from 'next/form'
import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useActionState} from 'react'

import {Alert, AlertDescription} from '@publish/ui/components/alert'
import AuthCard from '@publish/ui/components/auth-card'
import {Button} from '@publish/ui/components/button'
import {Input} from '@publish/ui/components/input'
import {Label} from '@publish/ui/components/label'

import {login, register} from '@/lib/api/client'
import {parseRegisterInput} from '@/lib/api/validation'
import {setTokens} from '@/lib/auth/tokenStore'
import {getClientTenantHost} from '@/lib/tenant/getClientTenantHost'

interface RegisterState {
    error: string | null
}

const INITIAL_STATE: RegisterState = {error: null}

export default function RegisterPage() {
    const router = useRouter()
    const [state, formAction, isPending] = useActionState(
        async (_previousState: RegisterState, formData: FormData) => {
            const input = parseRegisterInput({
                email: formData.get('email'),
                password: formData.get('password'),
                name: formData.get('name') || undefined,
            })
            if (input === null) {
                return {
                    error:
                        'Enter a valid email, a password of at least 12 characters, and an optional name.',
                }
            }

            try {
                const tenantHost = getClientTenantHost()
                await register(tenantHost, input)
                const tokens = await login(tenantHost, {
                    email: input.email,
                    password: input.password,
                })
                setTokens(tokens)
                router.push('/account')
                return INITIAL_STATE
            } catch (error) {
                return {
                    error:
                        error instanceof Error
                            ? error.message
                            : 'Registration failed. Please try again.',
                }
            }
        },
        INITIAL_STATE,
    )

    return (
        <AuthCard title="Registrieren" description="Erstelle dein Konto für exklusive Inhalte." footer={<><span>Bereits registriert? </span><Link className="underline" href="/login">Anmelden</Link></>}>
            <Form action={formAction} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="name">Name <span className="text-muted-foreground">(optional)</span></Label>
                    <Input id="name" name="name" type="text" autoComplete="name" maxLength={255} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="email">E-Mail</Label>
                    <Input id="email" name="email" type="email" autoComplete="email" maxLength={254} required />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="password">Passwort</Label>
                    <Input id="password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required />
                    <p className="text-xs text-muted-foreground">Mindestens 12 Zeichen.</p>
                </div>
                <Button className="w-full" type="submit" disabled={isPending}>
                    {isPending ? 'Registrierung läuft…' : 'Registrieren'}
                </Button>
            </Form>
            {state.error !== null ? <Alert variant="destructive"><AlertDescription>{state.error}</AlertDescription></Alert> : null}
        </AuthCard>
    )
}
