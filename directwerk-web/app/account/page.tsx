'use client'

import Form from 'next/form'
import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useActionState, useEffect, useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Button} from '@directwerk/ui/components/button'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'
import ResponsiveTable from '@directwerk/ui/components/responsive-table'
import SectionHeader from '@directwerk/ui/components/section-header'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@directwerk/ui/components/table'

import HowToListen from '@/components/HowToListen'
import {
    createPortalSession,
    forgotPassword,
    getAccess,
    getMe,
    getNotificationPreferences,
    getSiteConfig,
    listMyFeeds,
    listMySubscriptions,
    updateNotificationPreferences,
} from '@/lib/api/client'
import {AUTH_REQUIRED} from '@directwerk/api/constants'
import type {Access, Me, SubscriberFeed, SubscriptionSummary} from '@directwerk/api/types'
import {parseForgotPasswordInput} from '@directwerk/api/validation'
import {clearTokens} from '@/lib/auth/tokenStore'
import {getClientTenantHost} from '@/lib/tenant/getClientTenantHost'

interface LogoutState {
    complete: boolean
}

interface ChangePasswordState {
    error: string | null
    success: boolean
    resetHref: string | null
}

const CHANGE_PASSWORD_INITIAL: ChangePasswordState = {
    error: null,
    success: false,
    resetHref: null,
}

export default function AccountPage() {
    const router = useRouter()
    const [me, setMe] = useState<Me | null>(null)
    const [access, setAccess] = useState<Access | null>(null)
    const [feeds, setFeeds] = useState<SubscriberFeed[]>([])
    const [subscriptions, setSubscriptions] = useState<SubscriptionSummary[]>([])
    const [publicRssUrl, setPublicRssUrl] = useState<string | null>(null)
    const [portalMessage, setPortalMessage] = useState<string | null>(null)
    const [portalBusy, setPortalBusy] = useState(false)
    const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState<
        boolean | null
    >(null)
    const [prefsMessage, setPrefsMessage] = useState<string | null>(null)
    const [prefsBusy, setPrefsBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [, logoutAction, isLoggingOut] = useActionState(
        async (): Promise<LogoutState> => {
            // Best-effort server-side revocation before clearing local state;
            // failure here must not block the local logout.
            try {
                await fetch('/api/auth/logout', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Tenant-Host': getClientTenantHost(),
                    },
                    body: '{}',
                })
            } catch {
                // Ignore — clear local session regardless.
            }
            clearTokens()
            router.replace('/login')
            return {complete: true}
        },
        {complete: false},
    )
    const [changePasswordState, changePasswordAction, isChangingPassword] =
        useActionState(
            async (
                _previous: ChangePasswordState,
                formData: FormData,
            ): Promise<ChangePasswordState> => {
                const input = parseForgotPasswordInput({
                    email: formData.get('email'),
                })
                if (input === null) {
                    return {
                        error: 'Konto-E-Mail ist nicht verfügbar.',
                        success: false,
                        resetHref: null,
                    }
                }

                try {
                    const result = await forgotPassword(input)
                    return {
                        error: null,
                        success: true,
                        resetHref:
                            result.devResetToken === null
                                ? null
                                : `/reset-password?token=${encodeURIComponent(result.devResetToken)}`,
                    }
                } catch (requestError: unknown) {
                    return {
                        error:
                            requestError instanceof Error
                                ? requestError.message
                                : 'Passwortänderung konnte nicht gestartet werden.',
                        success: false,
                        resetHref: null,
                    }
                }
            },
            CHANGE_PASSWORD_INITIAL,
        )

    useEffect(() => {
        let isCurrent = true
        const tenantHost = getClientTenantHost()
        Promise.all([
            getMe(tenantHost),
            getAccess(tenantHost),
            getNotificationPreferences(tenantHost),
            listMyFeeds(tenantHost),
            listMySubscriptions(tenantHost),
            getSiteConfig(tenantHost),
        ])
            .then(([meResponse, accessResponse, prefs, feedList, subscriptionList, siteConfig]) => {
                if (isCurrent) {
                    setMe(meResponse.data)
                    setAccess(accessResponse.data)
                    setEmailNotificationsEnabled(prefs.emailNotificationsEnabled)
                    setFeeds(feedList)
                    setSubscriptions(subscriptionList)
                    setPublicRssUrl(siteConfig.data.publicRssUrl ?? null)
                }
            })
            .catch((requestError: unknown) => {
                if (!isCurrent) {
                    return
                }

                if (
                    requestError instanceof Error &&
                    requestError.message === AUTH_REQUIRED
                ) {
                    router.replace('/login')
                    return
                }

                setError(
                    requestError instanceof Error
                        ? requestError.message
                        : 'Konto konnte nicht geladen werden.',
                )
            })
            .finally(() => {
                if (isCurrent) {
                    setIsLoading(false)
                }
            })

        return () => {
            isCurrent = false
        }
    }, [router])

    async function handleToggleNotifications(
        nextValue: boolean,
    ): Promise<void> {
        setPrefsBusy(true)
        setPrefsMessage(null)
        try {
            const result = await updateNotificationPreferences(
                getClientTenantHost(),
                nextValue,
            )
            setEmailNotificationsEnabled(result.emailNotificationsEnabled)
            setPrefsMessage('Benachrichtigungen gespeichert.')
        } catch (requestError: unknown) {
            if (
                requestError instanceof Error &&
                requestError.message === AUTH_REQUIRED
            ) {
                router.replace('/login')
                return
            }
            setPrefsMessage(
                requestError instanceof Error
                    ? requestError.message
                    : 'Einstellungen konnten nicht gespeichert werden.',
            )
        } finally {
            setPrefsBusy(false)
        }
    }

    async function handlePortal(): Promise<void> {
        setPortalBusy(true)
        setPortalMessage(null)
        try {
            const returnUrl = `${window.location.origin}/account`
            const portalUrl = await createPortalSession(
                getClientTenantHost(),
                returnUrl,
            )
            if (portalUrl === null) {
                setPortalMessage('Kundenportal ist gerade nicht verfügbar.')
                return
            }
            window.location.assign(portalUrl)
        } catch (requestError: unknown) {
            if (
                requestError instanceof Error &&
                requestError.message === AUTH_REQUIRED
            ) {
                router.replace('/login')
                return
            }
            const message =
                requestError instanceof Error
                    ? requestError.message
                    : 'Kundenportal konnte nicht geöffnet werden.'
            setPortalMessage(
                message.toLowerCase().includes('not implemented')
                    ? 'Stripe ist auf diesem Server noch nicht eingerichtet.'
                    : message,
            )
        } finally {
            setPortalBusy(false)
        }
    }

    const defaultFeed = feeds.find((feed) => feed.isDefault) ?? null
    const hasPastDue = subscriptions.some((item) => item.status === 'PAST_DUE')
    const hasStripeMembership = subscriptions.some((item) => item.source === 'STRIPE')

    return (
        <PageStack className="page-container">
            <PageHeader
                title="Konto"
                description="Profil, Zugang, privater Feed und Benachrichtigungen."
            />
            {isLoading && <p className="text-sm text-muted-foreground">Wird geladen…</p>}
            {error !== null && (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {me !== null && (
                <section className="flex flex-col gap-4">
                    <SectionHeader title="Profil" />
                    <ResponsiveTable label="Profil">
                    <Table>
                        <TableBody>
                            <TableRow>
                                <TableHead scope="row">E-Mail</TableHead>
                                <TableCell>{me.email}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableHead scope="row">Name</TableHead>
                                <TableCell>{me.name ?? 'Nicht gesetzt'}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableHead scope="row">Rollen</TableHead>
                                <TableCell>{me.roles.join(', ')}</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                    </ResponsiveTable>
                    <p className="text-sm text-muted-foreground">
                        <Link href="/episodes">Meine Folgen</Link>
                        {' · '}
                        <Link href="/feeds">Feeds verwalten</Link>
                        {' · '}
                        <Link href="/pricing">Preise</Link>
                        {' · '}
                        <Link href="/downloads">Bonusdateien</Link>
                    </p>
                </section>
            )}

            {hasPastDue ? (
                <Alert variant="destructive">
                    <AlertDescription>
                        Eine Zahlung ist fehlgeschlagen. Dein Zugang ist pausiert,
                        bis die Karte im Kundenportal aktualisiert ist.
                    </AlertDescription>
                </Alert>
            ) : null}

            {access !== null && (
                <section className="flex flex-col gap-4">
                    <SectionHeader
                        description="Freie Folgen sind ohne Abo hörbar. Bezahlte Folgen und der private Feed brauchen eine aktive Stufe oder ein Paket."
                        title="Zugang"
                    />
                    <ResponsiveTable label="Zugang">
                    <Table>
                        <TableBody>
                            <TableRow>
                                <TableHead scope="row">Höchste Stufe</TableHead>
                                <TableCell>
                                    {access.maxLevelSortOrder ?? 'Keine'}
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                    </ResponsiveTable>
                    <SectionHeader as="h3" title="Aktive Stufen" />
                    {access.activeLevels.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            Keine — <Link href="/pricing">Mitgliedschaft wählen</Link>
                        </p>
                    ) : (
                        <ResponsiveTable label="Aktive Stufen">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead scope="col">Titel</TableHead>
                                    <TableHead scope="col">Kürzel</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {access.activeLevels.map((level) => (
                                    <TableRow key={level.id}>
                                        <TableCell>{level.title}</TableCell>
                                        <TableCell>{level.slug}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        </ResponsiveTable>
                    )}
                    <SectionHeader as="h3" title="Aktive Pakete" />
                    {access.activePackages.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Keine Pakete freigeschaltet.</p>
                    ) : (
                        <ResponsiveTable label="Aktive Pakete">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead scope="col">Titel</TableHead>
                                    <TableHead scope="col">Kürzel</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {access.activePackages.map((pkg) => (
                                    <TableRow key={pkg.id}>
                                        <TableCell>{pkg.title}</TableCell>
                                        <TableCell>{pkg.slug}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        </ResponsiveTable>
                    )}
                </section>
            )}

            <section className="flex flex-col gap-4">
                <SectionHeader title="Mitgliedschaften" />
                {subscriptions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        Keine.{' '}
                        <Link href="/pricing">Mitgliedschaft wählen</Link>
                    </p>
                ) : (
                    <ResponsiveTable label="Mitgliedschaften">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead scope="col">Produkt</TableHead>
                                <TableHead scope="col">Status</TableHead>
                                <TableHead scope="col">Quelle</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {subscriptions.map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell>{item.productTitle}</TableCell>
                                    <TableCell>
                                        {item.status === 'PAST_DUE'
                                            ? 'Zahlungsrückstand'
                                            : item.status === 'ACTIVE'
                                              ? 'Aktiv'
                                              : item.status}
                                    </TableCell>
                                    <TableCell>
                                        {item.source === 'STRIPE'
                                            ? 'Stripe'
                                            : 'Freischaltung'}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    </ResponsiveTable>
                )}
                {hasStripeMembership ? (
                    <div className="space-y-2">
                        <Button
                            disabled={portalBusy}
                            onClick={() => {
                                void handlePortal()
                            }}
                            type="button"
                            variant={hasPastDue ? 'default' : 'outline'}
                        >
                            {portalBusy
                                ? '…'
                                : hasPastDue
                                  ? 'Karte aktualisieren'
                                  : 'Zahlung im Kundenportal verwalten'}
                        </Button>
                        {portalMessage !== null ? (
                            <p role="status">{portalMessage}</p>
                        ) : null}
                    </div>
                ) : null}
            </section>

            <HowToListen
                isAuthenticated
                privateFeedUrl={
                    defaultFeed?.enabled === true ? defaultFeed.url : null
                }
                publicFeedUrl={publicRssUrl}
            />

            {emailNotificationsEnabled !== null && (
                <section className="flex flex-col gap-3">
                    <SectionHeader title="Benachrichtigungen" />
                    <p className="text-sm text-muted-foreground">
                        E-Mail bei neuen Inhalten:{' '}
                        <strong>
                            {emailNotificationsEnabled ? 'an' : 'aus'}
                        </strong>
                    </p>
                    <Button
                        disabled={prefsBusy}
                        onClick={() => {
                            void handleToggleNotifications(!emailNotificationsEnabled)
                        }}
                        type="button"
                    >
                        {prefsBusy
                            ? '…'
                            : emailNotificationsEnabled
                              ? 'Deaktivieren'
                              : 'Aktivieren'}
                    </Button>
                    {prefsMessage !== null ? (
                        <p role="status">{prefsMessage}</p>
                    ) : null}
                </section>
            )}

            {me !== null && (
                <section className="flex flex-col gap-3">
                    <SectionHeader title="Passwort" />
                    <p className="text-sm text-muted-foreground">
                        Sende eine Reset-Mail an <strong>{me.email}</strong>.
                    </p>
                    <Form action={changePasswordAction}>
                        <input type="hidden" name="email" value={me.email} />
                        <Button
                            type="submit"
                            disabled={isChangingPassword || changePasswordState.success}
                        >
                            {isChangingPassword
                                ? 'Senden…'
                                : 'Reset-E-Mail senden'}
                        </Button>
                    </Form>
                    {changePasswordState.error !== null && (
                        <p role="alert">{changePasswordState.error}</p>
                    )}
                    {changePasswordState.success && (
                        <p role="status">
                            Reset-E-Mail wurde gesendet, sofern das Konto berechtigt ist.
                            {changePasswordState.resetHref !== null && (
                                <>
                                    {' '}
                                    <Link href={changePasswordState.resetHref}>
                                        Reset-Link öffnen (Entwicklung)
                                    </Link>
                                </>
                            )}
                        </p>
                    )}
                </section>
            )}

            <Form action={logoutAction}>
                <Button type="submit" variant="outline" disabled={isLoggingOut}>
                    {isLoggingOut ? 'Abmelden…' : 'Abmelden'}
                </Button>
            </Form>
            <p className="text-sm text-muted-foreground">
                <Link href="/">Zur Startseite</Link>
            </p>
        </PageStack>
    )
}
