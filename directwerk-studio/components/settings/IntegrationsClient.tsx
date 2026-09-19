'use client'

import Link from 'next/link'
import {useEffect, useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Button} from '@directwerk/ui/components/button'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@directwerk/ui/components/card'
import {Input} from '@directwerk/ui/components/input'
import {Label} from '@directwerk/ui/components/label'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'
import SectionHeader from '@directwerk/ui/components/section-header'
import {Skeleton} from '@directwerk/ui/components/skeleton'

import SelectControl from '@/components/studio/SelectControl'
import {
    connectMailgun,
    disconnectEsp,
    getIntegrationsStatus,
} from '@/lib/api/integrationsApi'
import type {IntegrationsStatus} from '@directwerk/api/types'
import {getClientTenantHost} from '@directwerk/api/tenant'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'

export default function IntegrationsClient(): React.JSX.Element {
    const authRedirect = useAuthRequired()
    const [status, setStatus] = useState<IntegrationsStatus | null>(null)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [statusMessage, setStatusMessage] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [domain, setDomain] = useState('')
    const [fromEmail, setFromEmail] = useState('')
    const [fromName, setFromName] = useState('')
    const [region, setRegion] = useState('EU')
    const [apiKey, setApiKey] = useState('')
    const [reloadToken, setReloadToken] = useState(0)

    useEffect(() => {
        let active = true
        setIsLoading(true)
        setErrorMessage(null)
        getIntegrationsStatus(getClientTenantHost())
            .then((loaded) => {
                if (!active) {
                    return
                }
                setStatus(loaded)
                const mailgun = loaded.emailNotify.mailgun
                if (mailgun !== null) {
                    setDomain(mailgun.domain)
                    setFromEmail(mailgun.fromEmail)
                    setFromName(mailgun.fromName ?? '')
                    setRegion(String(mailgun.region))
                }
                setIsLoading(false)
            })
            .catch((error: unknown) => {
                if (!active) {
                    return
                }
                if (authRedirect(error)) return
                setErrorMessage(
                    error instanceof Error
                        ? error.message
                        : 'Integrationen konnten nicht geladen werden.',
                )
                setIsLoading(false)
            })
        return () => {
            active = false
        }
    }, [authRedirect, reloadToken])

    async function handleConnect(): Promise<void> {
        setIsSaving(true)
        setErrorMessage(null)
        setStatusMessage(null)
        try {
            await connectMailgun(getClientTenantHost(), {
                domain: domain.trim(),
                fromEmail: fromEmail.trim(),
                fromName: fromName.trim() || undefined,
                region,
                apiKey: apiKey.trim(),
            })
            setApiKey('')
            setStatusMessage('Mailgun verbunden. Content-E-Mails laufen über diese Domain.')
            setReloadToken((value) => value + 1)
        } catch (error: unknown) {
            if (authRedirect(error)) return
            setErrorMessage(error instanceof Error ? error.message : 'Verbindung fehlgeschlagen.')
        } finally {
            setIsSaving(false)
        }
    }

    async function handleDisconnect(): Promise<void> {
        setIsSaving(true)
        setErrorMessage(null)
        setStatusMessage(null)
        try {
            await disconnectEsp(getClientTenantHost())
            setStatusMessage('Mailgun-Verbindung entfernt. Es gilt wieder die Plattform-Zustellung.')
            setReloadToken((value) => value + 1)
        } catch (error: unknown) {
            if (authRedirect(error)) return
            setErrorMessage(error instanceof Error ? error.message : 'Trennen fehlgeschlagen.')
        } finally {
            setIsSaving(false)
        }
    }

    if (isLoading) {
        return (
            <PageStack>
                <PageHeader
                    eyebrow="Einstellungen"
                    title="Integrationen"
                    description="E-Mail-Zustellung, Analytics und Zahlungen."
                />
                <Skeleton className="h-32 w-full" />
            </PageStack>
        )
    }

    const email = status?.emailNotify
    const mailgun = email?.mailgun ?? null

    return (
        <PageStack>
            <PageHeader
                eyebrow="Einstellungen"
                title="Integrationen"
                description="Verbinde Mailgun für den Versand oder nutze die Plattform-Zustellung. Stripe und Analytics bleiben verlinkt."
            />
            {errorMessage !== null ? (
                <Alert variant="destructive">
                    <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
            ) : null}
            {statusMessage !== null ? (
                <Alert role="status">
                    <AlertDescription>{statusMessage}</AlertDescription>
                </Alert>
            ) : null}

            <section className="grid gap-4 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>E-Mail / Newsletter</CardTitle>
                        <CardDescription>
                            Modul {email?.moduleEnabled === true ? 'aktiv' : 'aus'} · Plattform-Sender{' '}
                            {email?.platformSenderReady === true ? 'bereit' : 'nicht bereit'} (
                            {email?.platformProvider ?? '—'})
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3 text-sm">
                        <p>
                            Eigene Vorlagen: {email?.customTemplateCount ?? 0}.{' '}
                            <Link className="underline" href="/settings/email">
                                E-Mail-Vorlagen
                            </Link>
                            {' · '}
                            <Link className="underline" href="/write/lists">
                                Listen
                            </Link>
                        </p>
                        {mailgun !== null ? (
                            <p>
                                Mailgun verbunden: {mailgun.domain} ({mailgun.fromEmail}, {mailgun.region})
                            </p>
                        ) : (
                            <p className="text-muted-foreground">
                                Noch kein Mailgun verbunden — Versand läuft über die Plattform.
                            </p>
                        )}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Analytics</CardTitle>
                        <CardDescription>
                            Modul {status?.analytics.moduleEnabled === true ? 'aktiv' : 'aus'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm">
                        <Link className="underline" href="/analytics">
                            Zu den Statistiken
                        </Link>
                        {' · '}
                        <Link className="underline" href="/settings/branding">
                            Umami im Branding
                        </Link>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Stripe</CardTitle>
                        <CardDescription>
                            {status?.stripe.message ?? 'Status unbekannt'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm">
                        <Link className="underline" href="/settings/stripe">
                            Stripe-Einstellungen
                        </Link>
                    </CardContent>
                </Card>
            </section>

            <section className="flex flex-col gap-4">
                <SectionHeader
                    title="Mailgun verbinden"
                    description="API-Schlüssel wird verschlüsselt gespeichert. Danach gehen Benachrichtigungen über deine Domain."
                />
                <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-2">
                        <Label htmlFor="mg-domain">Sending-Domain</Label>
                        <Input
                            disabled={isSaving}
                            id="mg-domain"
                            onChange={(event) => setDomain(event.target.value)}
                            placeholder="mg.beispiel.de"
                            value={domain}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="mg-from">Absender-E-Mail</Label>
                        <Input
                            disabled={isSaving}
                            id="mg-from"
                            onChange={(event) => setFromEmail(event.target.value)}
                            placeholder="hello@beispiel.de"
                            type="email"
                            value={fromEmail}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="mg-name">Absendername</Label>
                        <Input
                            disabled={isSaving}
                            id="mg-name"
                            onChange={(event) => setFromName(event.target.value)}
                            value={fromName}
                        />
                    </div>
                    <label className="grid gap-1.5 text-sm">
                        <span>Region</span>
                        <SelectControl
                            disabled={isSaving}
                            id="mg-region"
                            onChange={(event) => setRegion(event.target.value)}
                            value={region}
                        >
                            <option value="EU">EU</option>
                            <option value="US">US</option>
                        </SelectControl>
                    </label>
                    <div className="grid gap-2 sm:col-span-2">
                        <Label htmlFor="mg-key">API-Schlüssel</Label>
                        <Input
                            disabled={isSaving}
                            id="mg-key"
                            onChange={(event) => setApiKey(event.target.value)}
                            placeholder={mailgun?.apiKeyConfigured === true ? '•••••••• (neu setzen)' : 'key-…'}
                            type="password"
                            value={apiKey}
                        />
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button disabled={isSaving || apiKey.trim().length === 0} onClick={() => void handleConnect()} type="button">
                        Mailgun speichern
                    </Button>
                    {mailgun !== null ? (
                        <Button
                            disabled={isSaving}
                            onClick={() => void handleDisconnect()}
                            type="button"
                            variant="outline"
                        >
                            Verbindung trennen
                        </Button>
                    ) : null}
                </div>
            </section>
        </PageStack>
    )
}
