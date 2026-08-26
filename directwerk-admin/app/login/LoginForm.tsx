'use client'

import Form from 'next/form'
import {useRouter} from 'next/navigation'
import {useActionState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Button} from '@directwerk/ui/components/button'
import {Input} from '@directwerk/ui/components/input'
import {Label} from '@directwerk/ui/components/label'

import type {OAuthTokenResponse} from '@directwerk/api/types'
import {invalidatePendingRefresh} from '@/lib/auth/session'
import {storeTokens} from '@/lib/auth/tokenStore'

interface LoginState {
    error: string | null
}

const INITIAL_STATE: LoginState = {error: null}

function isOAuthTokenResponse(value: unknown): value is OAuthTokenResponse {
    if (typeof value !== 'object' || value === null) {
        return false
    }

    const token = value as Record<string, unknown>
    return (
        typeof token.access_token === 'string' &&
        token.access_token.length > 0 &&
        token.access_token.length <= 8192 &&
        typeof token.token_type === 'string' &&
        token.token_type.toLowerCase() === 'bearer' &&
        (token.refresh_token === undefined ||
            (typeof token.refresh_token === 'string' &&
                token.refresh_token.length <= 8192))
    )
}

export default function LoginForm() {
    const router = useRouter()

    async function loginAction(
        _previousState: LoginState,
        formData: FormData
    ): Promise<LoginState> {
        const email = formData.get('email')
        const password = formData.get('password')

        if (typeof email !== 'string' || typeof password !== 'string') {
            return {error: 'Enter your email address and password.'}
        }

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({email, password}),
            })
            const body: unknown = await response.json()

            if (!response.ok || !isOAuthTokenResponse(body)) {
                return {error: 'Login failed. Check your credentials.'}
            }

            // End any refresh that is still in flight for the previous
            // identity so it cannot overwrite this fresh login.
            invalidatePendingRefresh()
            storeTokens(body)
            router.replace('/')
            return INITIAL_STATE
        } catch {
            return {error: 'Login is unavailable. Try again later.'}
        }
    }

    const [state, formAction, pending] = useActionState(
        loginAction,
        INITIAL_STATE
    )

    return (
        <Form action={formAction} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                    autoComplete="username"
                    id="email"
                    maxLength={254}
                    name="email"
                    required
                    type="email"
                />
            </div>
            <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                    autoComplete="current-password"
                    id="password"
                    maxLength={1024}
                    name="password"
                    required
                    type="password"
                />
            </div>
            {state.error ? (
                <Alert aria-live="polite" variant="destructive">
                    <AlertDescription>{state.error}</AlertDescription>
                </Alert>
            ) : null}
            <Button className="w-full" disabled={pending} type="submit">
                {pending ? 'Signing in…' : 'Sign in'}
            </Button>
        </Form>
    )
}
