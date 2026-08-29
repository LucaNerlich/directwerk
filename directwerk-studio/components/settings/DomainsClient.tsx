'use client'

import {Button} from '@directwerk/ui/components/button'
import {Input} from '@directwerk/ui/components/input'

import Form from 'next/form'
import {useRouter} from 'next/navigation'
import {useActionState, useCallback, useEffect, useState} from 'react'

import {AUTH_REQUIRED} from '@directwerk/api/constants'
import {addDomain, getDomainVerification, listDomains, verifyDomain} from '@/lib/api/tenantSettingsApi'
import type {DomainVerificationChallenge, TenantDomain} from '@directwerk/api/types'
import {getClientTenantHost} from '@directwerk/api/tenant'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'

interface AddDomainState {
    error: string | null
    success: string | null
}

const INITIAL_ADD_STATE: AddDomainState = {error: null, success: null}

const HOST_PATTERN = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/i

export default function DomainsClient(): React.JSX.Element {
    const router = useRouter()
    const authRedirect = useAuthRequired()
    const [domains, setDomains] = useState<TenantDomain[]>([])
    const [loadError, setLoadError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [challenge, setChallenge] = useState<DomainVerificationChallenge | null>(
        null,
    )
    const [actionError, setActionError] = useState<string | null>(null)
    const [actionStatus, setActionStatus] = useState<string | null>(null)
    const [busyHost, setBusyHost] = useState<string | null>(null)

    const reload = useCallback(async (): Promise<void> => {
        const result = await listDomains(getClientTenantHost())
        setDomains(result)
    }, [])

    useEffect(() => {
        let active = true

        reload()
            .then(() => {
                if (!active) {
                    return
                }
                setIsLoading(false)
            })
            .catch((error: unknown) => {
                if (!active) {
                    return
                }
                if (authRedirect(error)) return
                setLoadError(
                    error instanceof Error
                        ? error.message
                        : 'Domains konnten nicht geladen werden.',
                )
                setIsLoading(false)
            })

        return () => {
            active = false
        }
    }, [reload, router])

    async function addAction(
        _previous: AddDomainState,
        formData: FormData,
    ): Promise<AddDomainState> {
        const host = String(formData.get('host') ?? '')
            .trim()
            .toLowerCase()
        const isPrimary = formData.get('isPrimary') === 'on'

        if (host.length === 0 || host.length > 253 || !HOST_PATTERN.test(host)) {
            return {error: 'Bitte eine gültige Domain eingeben.', success: null}
        }

        try {
            await addDomain(getClientTenantHost(), {host, isPrimary})
            await reload()
            return {error: null, success: `Domain ${host} hinzugefügt.`}
        } catch (error: unknown) {
            if (authRedirect(error)) return INITIAL_ADD_STATE
            return {
                error:
                    error instanceof Error
                        ? error.message
                        : 'Domain konnte nicht hinzugefügt werden.',
                success: null,
            }
        }
    }

    const [addState, addFormAction, addPending] = useActionState(
        addAction,
        INITIAL_ADD_STATE,
    )

    async function showVerification(host: string): Promise<void> {
        setBusyHost(host)
        setActionError(null)
        setActionStatus(null)
        try {
            const result = await getDomainVerification(getClientTenantHost(), host)
            setChallenge(result)
        } catch (error: unknown) {
            if (authRedirect(error)) return
            setActionError(
                error instanceof Error
                    ? error.message
                    : 'Verifizierung konnte nicht geladen werden.',
            )
        } finally {
            setBusyHost(null)
        }
    }

    async function runVerify(host: string): Promise<void> {
        setBusyHost(host)
        setActionError(null)
        setActionStatus(null)
        try {
            await verifyDomain(getClientTenantHost(), host)
            await reload()
            setChallenge(null)
            setActionStatus(`${host} ist verifiziert.`)
        } catch (error: unknown) {
            if (authRedirect(error)) return
            setActionError(
                error instanceof Error
                    ? error.message
                    : 'Verifizierung fehlgeschlagen.',
            )
        } finally {
            setBusyHost(null)
        }
    }

    if (isLoading) {
        return <p>Wird geladen…</p>
    }

    if (loadError !== null) {
        return <p className="text-sm text-destructive">{loadError}</p>
    }

    return (
        <div className="flex flex-col gap-6">
            <header className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Einstellungen</p>
                    <h1>Domains</h1>
                </div>
            </header>

            {domains.length === 0 ? (
                <p className="text-sm text-muted-foreground">Noch keine Domains.</p>
            ) : (
                <ul className="overflow-hidden rounded-xl border bg-card divide-y [&>li]:flex [&>li]:items-center [&>li]:justify-between [&>li]:gap-4 [&>li]:p-4">
                    {domains.map((domain) => (
                        <li key={domain.host}>
                            <div>
                                <strong>{domain.host}</strong>
                                <span className="flex shrink-0 items-center gap-3 text-sm text-muted-foreground">
                                    {domain.primary ? 'Primär' : 'Sekundär'}
                                    {' · '}
                                    {domain.verified ? 'Verifiziert' : 'Offen'}
                                </span>
                            </div>
                            {!domain.verified ? (
                                <div className="flex shrink-0 items-center gap-3 text-sm text-muted-foreground">
                                    <Button
                                        className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
                                        disabled={busyHost === domain.host}
                                        onClick={() => {
                                            void showVerification(domain.host)
                                        }}
                                        type="button"
                                    >
                                        DNS-Hinweis
                                    </Button>
                                    <Button
                                        className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
                                        disabled={busyHost === domain.host}
                                        onClick={() => {
                                            void runVerify(domain.host)
                                        }}
                                        type="button"
                                    >
                                        Verifizieren
                                    </Button>
                                </div>
                            ) : null}
                        </li>
                    ))}
                </ul>
            )}

            {challenge !== null ? (
                <section aria-labelledby="domain-challenge-heading">
                    <h2 id="domain-challenge-heading">DNS-Verifizierung</h2>
                    <p>
                        Host: <code>{challenge.host}</code>
                    </p>
                    <p>
                        TXT-Name: <code>{challenge.dnsNameHint}</code>
                    </p>
                    <p>
                        TXT-Wert: <code>{challenge.dnsTxtValue}</code>
                    </p>
                </section>
            ) : null}

            {actionError ? (
                <p aria-live="polite" className="text-sm text-destructive" role="alert">
                    {actionError}
                </p>
            ) : null}
            {actionStatus ? (
                <p aria-live="polite" role="status">
                    {actionStatus}
                </p>
            ) : null}

            <Form action={addFormAction} className="grid w-full max-w-xl gap-5">
                <h2>Domain hinzufügen</h2>
                <label className="grid gap-2 text-sm font-medium" htmlFor="host">
                    Host
                    <Input
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                        id="host"
                        maxLength={253}
                        name="host"
                        placeholder="podcast.beispiel.de"
                        required
                        type="text"
                    />
                </label>
                <label className="grid gap-2 text-sm font-medium" htmlFor="isPrimary">
                    <span>
                        <Input id="isPrimary" name="isPrimary" className="size-4 shrink-0" type="checkbox" /> Primäre
                        Domain
                    </span>
                </label>
                {addState.error ? (
                    <p aria-live="polite" className="text-sm text-destructive" role="alert">
                        {addState.error}
                    </p>
                ) : null}
                {addState.success ? (
                    <p aria-live="polite" role="status">
                        {addState.success}
                    </p>
                ) : null}
                <Button className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50" disabled={addPending} type="submit">
                    {addPending ? 'Hinzufügen…' : 'Hinzufügen'}
                </Button>
            </Form>
        </div>
    )
}
