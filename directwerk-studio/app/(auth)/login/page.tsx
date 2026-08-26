'use client'

import {Button} from '@directwerk/ui/components/button'
import {Input} from '@directwerk/ui/components/input'
import AuthCard from '@directwerk/ui/components/auth-card'

import Form from 'next/form'
import {useRouter, useSearchParams} from 'next/navigation'
import {Suspense, useActionState} from 'react'

import {defaultHomePath} from '@/lib/api/client'
import {login} from '@/lib/api/tenantApi'
import {parseLoginInput} from '@directwerk/api/validation'
import {setTokens} from '@/lib/auth/tokenStore'
import {useSiteConfig} from '@/lib/site/SiteConfigProvider'
import {getClientTenantHost} from '@/lib/tenant/getClientTenantHost'

interface LoginState {
    error: string | null
}

const INITIAL_STATE: LoginState = {error: null}

function LoginForm() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const config = useSiteConfig()
    const roleDenied = searchParams.get('reason') === 'role'
    const [state, formAction, isPending] = useActionState(
        async (_previousState: LoginState, formData: FormData) => {
            const input = parseLoginInput({
                email: formData.get('email'),
                password: formData.get('password'),
            })
            if (input === null) {
                return {
                    error: 'Bitte gültige E-Mail und Passwort (mind. 12 Zeichen) eingeben.',
                }
            }

            try {
                const tokens = await login(getClientTenantHost(), input)
                setTokens(tokens)
                router.push(defaultHomePath(config.studioHome))
                return INITIAL_STATE
            } catch (error) {
                return {
                    error:
                        error instanceof Error
                            ? error.message
                            : 'Anmeldung fehlgeschlagen. Bitte erneut versuchen.',
                }
            }
        },
        INITIAL_STATE,
    )

    return (
        <AuthCard
            title="Studio anmelden"
            description={`Bei ${config.tenant.name} anmelden`}
        >
                {roleDenied && (
                    <p className="text-sm text-destructive" role="alert">
                        Studio ist nur für Editoren und Mandanten-Admins verfügbar.
                    </p>
                )}
                <Form action={formAction} className="grid gap-4">
                    <label className="grid gap-2 text-sm font-medium">
                        <span>E-Mail</span>
                        <Input
                            name="email"
                            type="email"
                            autoComplete="email"
                            maxLength={254}
                            required
                        />
                    </label>
                    <label className="grid gap-2 text-sm font-medium">
                        <span>Passwort</span>
                        <Input
                            name="password"
                            type="password"
                            autoComplete="current-password"
                            minLength={12}
                            maxLength={128}
                            required
                        />
                    </label>
                    <Button type="submit" disabled={isPending}>
                        {isPending ? 'Anmeldung…' : 'Anmelden'}
                    </Button>
                </Form>
                {state.error !== null && (
                    <p className="text-sm text-destructive" role="alert">
                        {state.error}
                    </p>
                )}
        </AuthCard>
    )
}

export default function LoginPage() {
    return (
        <Suspense fallback={<p>Wird geladen…</p>}>
            <LoginForm />
        </Suspense>
    )
}
