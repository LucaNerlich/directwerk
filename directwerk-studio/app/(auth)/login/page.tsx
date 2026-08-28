'use client'

import Form from 'next/form'
import {useRouter, useSearchParams} from 'next/navigation'
import {Suspense, useActionState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import AuthCard from '@directwerk/ui/components/auth-card'
import {Button} from '@directwerk/ui/components/button'
import {Input} from '@directwerk/ui/components/input'
import {Label} from '@directwerk/ui/components/label'

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
            description={`Bei ${config.tenant.name} anmelden`}
            title="Studio anmelden"
        >
            {roleDenied ? (
                <Alert variant="destructive">
                    <AlertDescription>
                        Studio ist nur für Editoren und Mandanten-Admins verfügbar.
                    </AlertDescription>
                </Alert>
            ) : null}
            <Form action={formAction} className="grid gap-4">
                <div className="grid gap-2">
                    <Label htmlFor="login-email">E-Mail</Label>
                    <Input
                        autoComplete="email"
                        id="login-email"
                        maxLength={254}
                        name="email"
                        required
                        type="email"
                    />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="login-password">Passwort</Label>
                    <Input
                        autoComplete="current-password"
                        id="login-password"
                        maxLength={128}
                        minLength={12}
                        name="password"
                        required
                        type="password"
                    />
                </div>
                <Button disabled={isPending} type="submit">
                    {isPending ? 'Anmeldung…' : 'Anmelden'}
                </Button>
            </Form>
            {state.error !== null ? (
                <Alert variant="destructive">
                    <AlertDescription>{state.error}</AlertDescription>
                </Alert>
            ) : null}
        </AuthCard>
    )
}

export default function LoginPage() {
    return (
        <Suspense fallback={<p className="text-sm text-muted-foreground">Wird geladen…</p>}>
            <LoginForm />
        </Suspense>
    )
}
