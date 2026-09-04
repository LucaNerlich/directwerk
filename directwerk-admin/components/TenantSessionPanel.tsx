'use client'

import {useEffect, useState, type FormEvent} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Badge} from '@directwerk/ui/components/badge'
import {Button} from '@directwerk/ui/components/button'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@directwerk/ui/components/card'
import {Input} from '@directwerk/ui/components/input'
import {Label} from '@directwerk/ui/components/label'

import {
    clearTenantTokens,
    getTenantSessionHostSafe,
    subscribeToTenantTokenStore,
} from '@/lib/auth/tenantTokenStore'
import {loginTenantSession} from '@/lib/auth/tenantSession'
import {parseTenantHost} from '@directwerk/api/proxy'

interface TenantSessionPanelProps {
    onSessionChange?: () => void
}

export default function TenantSessionPanel({
    onSessionChange,
}: TenantSessionPanelProps) {
    // Initialized empty/null so server rendering never touches sessionStorage
    // (which does not exist on the server); hydrated from the store on mount.
    const [tenantHost, setTenantHost] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [connectedHost, setConnectedHost] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [status, setStatus] = useState<string | null>(null)
    const [pending, setPending] = useState(false)

    useEffect(() => {
        const storedHost = getTenantSessionHostSafe()
        setTenantHost(storedHost ?? '')
        setConnectedHost(storedHost)
        // Stay in sync when another panel clears the session (e.g. an
        // expired tenant token cleared by the products panel).
        return subscribeToTenantTokenStore(() => {
            setConnectedHost(getTenantSessionHostSafe())
        })
    }, [])

    async function handleLogin(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault()
        setPending(true)
        setError(null)
        setStatus(null)

        const parsedHost = parseTenantHost(tenantHost)
        if (parsedHost === null) {
            setError('Enter a valid tenant host (e.g. alpha-a.localhost).')
            setPending(false)
            return
        }

        try {
            await loginTenantSession({
                email: email.trim(),
                password,
                tenantHost: parsedHost,
            })
            setConnectedHost(parsedHost)
            setPassword('')
            setStatus(`Connected as tenant admin on ${parsedHost}.`)
            onSessionChange?.()
        } catch {
            setError(
                'Tenant login failed. Check host, credentials, and TENANT_OAUTH_* env.'
            )
        } finally {
            setPending(false)
        }
    }

    function handleClear(): void {
        clearTenantTokens()
        setConnectedHost(null)
        setStatus('Tenant session cleared.')
        setError(null)
        onSessionChange?.()
    }

    return (
        <Card aria-labelledby="tenant-session-heading" role="region">
            <CardHeader>
            <CardTitle id="tenant-session-heading">Tenant session</CardTitle>
            <CardDescription>
                Platform JWT cannot call <code>/api/v1/tenant/*</code>. Sign in
                with a tenant admin account (separate OAuth client) to manage
                products and grants.
            </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
            {connectedHost ? (
                <div className="flex flex-wrap items-center gap-2" role="status">
                    Active tenant host: <Badge variant="outline">{connectedHost}</Badge>
                    <Button onClick={handleClear} type="button" variant="outline">
                        Clear session
                    </Button>
                </div>
            ) : (
                <p className="text-sm text-muted-foreground">No tenant session.</p>
            )}
            <form className="grid gap-4 sm:grid-cols-3" onSubmit={(event) => void handleLogin(event)}>
                <div className="space-y-2">
                    <Label htmlFor="tenant-session-host">Tenant host</Label>
                    <Input
                        id="tenant-session-host"
                        onChange={(event) => setTenantHost(event.target.value)}
                        placeholder="alpha-a.localhost"
                        required
                        type="text"
                        value={tenantHost}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="tenant-session-email">Email</Label>
                    <Input
                        autoComplete="username"
                        id="tenant-session-email"
                        onChange={(event) => setEmail(event.target.value)}
                        required
                        type="email"
                        value={email}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="tenant-session-password">Password</Label>
                    <Input
                        autoComplete="current-password"
                        id="tenant-session-password"
                        onChange={(event) => setPassword(event.target.value)}
                        required
                        type="password"
                        value={password}
                    />
                </div>
                {error ? (
                    <Alert aria-live="polite" className="sm:col-span-3" variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
                ) : null}
                {status ? (
                    <p aria-live="polite" role="status" className="text-sm text-muted-foreground sm:col-span-3">
                        {status}
                    </p>
                ) : null}
                <Button className="w-fit sm:col-span-3" disabled={pending} type="submit">
                    {pending ? 'Signing in…' : 'Sign in to tenant'}
                </Button>
            </form>
            </CardContent>
        </Card>
    )
}
