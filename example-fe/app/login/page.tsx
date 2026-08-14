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

import {login} from '@/lib/api/client'
import {parseLoginInput} from '@/lib/api/validation'
import {setTokens} from '@/lib/auth/tokenStore'
import {getSelectedTenant} from '@/lib/tenantStore'

interface LoginState {
    error: string | null
}

const INITIAL_STATE: LoginState = {error: null}

export default function LoginPage() {
    const router = useRouter()
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
                const tokens = await login(getSelectedTenant(), input)
                setTokens(tokens)
                router.push('/account')
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
            title="Login"
            description="Sign in to access subscriber content and account settings."
            footer={<><span>Need an account? </span><Link className="underline" href="/register">Register</Link><span> · </span><Link className="underline" href="/">Tenant selection</Link></>}
        >
            <Form action={formAction} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" name="email" type="email" autoComplete="email" maxLength={254} required />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" name="password" type="password" autoComplete="current-password" minLength={12} maxLength={128} required />
                </div>
                <Button className="w-full" type="submit" disabled={isPending}>
                    {isPending ? 'Logging in…' : 'Login'}
                </Button>
            </Form>
            {state.error !== null ? <Alert variant="destructive"><AlertDescription>{state.error}</AlertDescription></Alert> : null}
            <Link className="text-sm underline underline-offset-4" href="/forgot-password">Forgot password?</Link>
        </AuthCard>
    )
}
