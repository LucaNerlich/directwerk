'use client'

import Form from 'next/form'
import {useRouter} from 'next/navigation'
import {useActionState, useEffect} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Button} from '@directwerk/ui/components/button'
import {Input} from '@directwerk/ui/components/input'
import {Label} from '@directwerk/ui/components/label'

import {invalidatePendingRefresh} from '@/lib/auth/session'
import {storeTokens} from '@/lib/auth/tokenStore'

import {loginAction, type LoginActionState} from './actions'

const INITIAL_STATE: LoginActionState = {error: null, tokens: null}

export default function LoginForm() {
    const router = useRouter()

    const [state, formAction, pending] = useActionState(
        loginAction,
        INITIAL_STATE
    )

    // Client-side effects after a successful server action: store the access
    // token, reset any in-flight refresh for the previous identity, and enter
    // the admin area.
    useEffect(() => {
        if (state.tokens === null) {
            return
        }

        invalidatePendingRefresh()
        storeTokens(state.tokens)
        router.replace('/')
    }, [state.tokens, router])

    return (
        <Form action={formAction} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                    autoComplete="username"
                    disabled={pending}
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
                    disabled={pending}
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
