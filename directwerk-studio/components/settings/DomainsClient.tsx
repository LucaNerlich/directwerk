'use client'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Badge} from '@directwerk/ui/components/badge'
import {Button} from '@directwerk/ui/components/button'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@directwerk/ui/components/card'
import {Checkbox} from '@directwerk/ui/components/checkbox'
import EmptyState from '@directwerk/ui/components/empty-state'
import {EntityListSection} from '@directwerk/ui/components/entity-list-section'
import type {EntityListViewItem} from '@directwerk/ui/components/entity-list-view'
import {Input} from '@directwerk/ui/components/input'
import {Label} from '@directwerk/ui/components/label'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'
import SectionHeader from '@directwerk/ui/components/section-header'
import {Skeleton} from '@directwerk/ui/components/skeleton'
import {useListViewMode} from '@directwerk/ui/hooks/use-list-view-mode'

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
    const {viewMode, setViewMode} = useListViewMode()

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
        return (
            <PageStack>
                <PageHeader
                    eyebrow="Einstellungen"
                    title="Domains"
                    description="Eigene Domains für deine öffentliche Website — erst prüfen, dann verifizieren."
                />
                <p className="text-sm text-muted-foreground" role="status">Wird geladen…</p>
                <Skeleton className="h-20 w-full" />
            </PageStack>
        )
    }

    if (loadError !== null) {
        return (
            <PageStack>
                <PageHeader
                    eyebrow="Einstellungen"
                    title="Domains"
                    description="Eigene Domains für deine öffentliche Website — erst prüfen, dann verifizieren."
                />
                <Alert variant="destructive">
                    <AlertDescription>{loadError}</AlertDescription>
                </Alert>
            </PageStack>
        )
    }

    const domainItems: EntityListViewItem[] = domains.map((domain) => ({
        id: domain.host,
        title: domain.host,
        description: domain.primary ? 'Primäre Domain — Standardadresse deiner Website' : 'Sekundäre Domain — leitet auf die primäre',
        trailing: (
            <Badge variant={domain.verified ? 'default' : 'outline'}>
                {domain.verified ? 'Verifiziert' : 'Offen'}
            </Badge>
        ),
        actions: !domain.verified ? (
            <div className="flex flex-wrap gap-2">
                <Button
                    disabled={busyHost === domain.host}
                    onClick={() => {
                        void showVerification(domain.host)
                    }}
                    size="sm"
                    type="button"
                    variant="outline"
                >
                    DNS-Hinweis
                </Button>
                <Button
                    disabled={busyHost === domain.host}
                    onClick={() => {
                        void runVerify(domain.host)
                    }}
                    size="sm"
                    type="button"
                >
                    {busyHost === domain.host ? 'Prüfen…' : 'Verifizieren'}
                </Button>
            </div>
        ) : undefined,
    }))

    return (
        <PageStack>
            <PageHeader
                eyebrow="Einstellungen"
                title="Domains"
                description="Eigene Domains für deine öffentliche Website. Lege zuerst den TXT-Eintrag beim Domain-Anbieter an, dann prüfe die Verifizierung."
            />

            {domains.length === 0 ? (
                <EmptyState
                    title="Noch keine Domains"
                    description="Füge unten deine erste Domain hinzu — z. B. podcast.beispiel.de. Danach legst du den angezeigten TXT-Eintrag an."
                />
            ) : (
                <section aria-labelledby="domains-list-heading" className="flex flex-col gap-4">
                    <SectionHeader
                        id="domains-list-heading"
                        title={`Domains (${domains.length})`}
                        description="Verifizierte Domains sind live; offene brauchen noch den DNS-Eintrag."
                    />
                <EntityListSection
                    items={domainItems}
                    onViewModeChange={setViewMode}
                    showSelection={false}
                    viewMode={viewMode}
                />
                </section>
            )}

            {challenge !== null ? (
                <Card aria-labelledby="domain-challenge-heading">
                    <CardHeader>
                        <CardTitle id="domain-challenge-heading">DNS-Verifizierung</CardTitle>
                        <CardDescription>
                            Lege diesen TXT-Eintrag bei deinem Domain-Anbieter an und klicke danach auf „Verifizieren“.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3 text-sm">
                    <p>
                        Host: <code className="rounded bg-muted px-1.5 py-0.5">{challenge.host}</code>
                    </p>
                    <p>
                        TXT-Name: <code className="rounded bg-muted px-1.5 py-0.5 break-all">{challenge.dnsNameHint}</code>
                    </p>
                    <p>
                        TXT-Wert: <code className="rounded bg-muted px-1.5 py-0.5 break-all">{challenge.dnsTxtValue}</code>
                    </p>
                    <p className="text-xs text-muted-foreground">
                        Die DNS-Ausbreitung kann einige Minuten dauern. Bei Fehlschlag warte kurz und versuche es erneut.
                    </p>
                    </CardContent>
                </Card>
            ) : null}

            {actionError ? (
                <Alert variant="destructive">
                    <AlertDescription>{actionError}</AlertDescription>
                </Alert>
            ) : null}
            {actionStatus ? (
                <Alert role="status">
                    <AlertDescription>{actionStatus}</AlertDescription>
                </Alert>
            ) : null}

            <Card className="max-w-xl">
                <CardHeader>
                    <CardTitle>Domain hinzufügen</CardTitle>
                    <CardDescription>Nur der Hostname — ohne https:// und ohne Pfad.</CardDescription>
                </CardHeader>
                <CardContent>
            <Form action={addFormAction} className="grid w-full gap-5">
                <div className="grid gap-2">
                    <Label htmlFor="host">Host</Label>
                    <Input
                        aria-describedby="host-help"
                        id="host"
                        maxLength={253}
                        name="host"
                        placeholder="podcast.beispiel.de"
                        required
                        type="text"
                    />
                    <p className="text-xs text-muted-foreground" id="host-help">
                        z. B. podcast.beispiel.de — Kleinbuchstaben, Zahlen, Punkte und Bindestriche.
                    </p>
                </div>
                <Label className="flex items-center gap-2 font-normal">
                    <Checkbox id="isPrimary" name="isPrimary" />
                    <span>Primäre Domain <span className="text-muted-foreground">(Standardadresse deiner Website)</span></span>
                </Label>
                {addState.error ? (
                    <Alert variant="destructive">
                        <AlertDescription>{addState.error}</AlertDescription>
                    </Alert>
                ) : null}
                {addState.success ? (
                    <Alert role="status">
                        <AlertDescription>{addState.success}</AlertDescription>
                    </Alert>
                ) : null}
                <div>
                <Button disabled={addPending} type="submit">
                    {addPending ? 'Hinzufügen…' : 'Hinzufügen'}
                </Button>
                </div>
            </Form>
                </CardContent>
            </Card>
        </PageStack>
    )
}
