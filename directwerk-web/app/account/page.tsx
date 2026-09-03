'use client'

import Form from 'next/form'
import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useActionState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Badge} from '@directwerk/ui/components/badge'
import {Button} from '@directwerk/ui/components/button'
import FeatureCard from '@directwerk/ui/components/feature-card'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'
import ResponsiveTable from '@directwerk/ui/components/responsive-table'
import SectionHeader from '@directwerk/ui/components/section-header'
import StatCard from '@directwerk/ui/components/stat-card'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@directwerk/ui/components/table'

import {useAccountDashboard} from '@/lib/account/useAccountDashboard'
import {forgotPassword} from '@/lib/api/client'
import {parseForgotPasswordInput} from '@directwerk/api/validation/input'
import {
    billingSourceLabel,
    subscriptionStatusLabel,
} from '@/lib/format/content'
import {userFacingGeneralError} from '@/lib/billing/userFacingBillingError'
import {formatPublishedAt} from '@directwerk/api/format/datetime'

import {clearTokens} from '@/lib/auth/tokenStore'
import {getClientTenantHost} from '@/lib/tenant/clientHost'

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

function roleLabel(role: string): string {
    switch (role) {
        case 'SUBSCRIBER':
            return 'Mitglied'
        case 'TENANT_ADMIN':
            return 'Verwaltung'
        case 'EDITOR':
            return 'Redaktion'
        case 'PLATFORM_ADMIN':
            return 'Plattformverwaltung'
        case 'GUEST':
            return 'Gast'
        default:
            return role
    }
}

function renewalLabel(status: string, endsAt: string | null): string {
    if (endsAt !== null) {
        const date = formatPublishedAt(endsAt)
        if (status === 'CANCELED') {
            return `Beendet am ${date}`
        }
        return `Läuft bis ${date}`
    }
    if (status === 'ACTIVE') {
        return 'Läuft fortlaufend'
    }
    if (status === 'PAST_DUE') {
        return 'Zahlung überfällig'
    }
    return '—'
}

function sourceActionLabel(source: string): string {
    switch (source) {
        case 'STRIPE':
            return 'Siehe Kundenportal unten'
        case 'PATREON':
            return 'Im Patreon-Konto verwalten'
        case 'STEADY':
            return 'Im Steady-Konto verwalten'
        case 'MANUAL':
            return 'Bei der Redaktion melden'
        default:
            return 'Beim Anbieter verwalten'
    }
}

export default function AccountPage() {
    const router = useRouter()
    const {
        me,
        access,
        subscriptions,
        emailNotificationsEnabled,
        emailNotifyAvailable,
        error,
        isLoading,
        prefsMessage,
        prefsMessageKind,
        prefsBusy,
        portalMessage,
        portalBusy,
        handleToggleNotifications,
        handlePortal,
    } = useAccountDashboard()
    const [, logoutAction, isLoggingOut] = useActionState(
        async (): Promise<LogoutState> => {
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
                        error: userFacingGeneralError(
                            requestError,
                            'Passwortänderung konnte nicht gestartet werden. Bitte versuche es später erneut.',
                        ),
                        success: false,
                        resetHref: null,
                    }
                }
            },
            CHANGE_PASSWORD_INITIAL,
        )

    const hasPastDue = subscriptions.some((item) => item.status === 'PAST_DUE')
    const hasStripeMembership = subscriptions.some((item) => item.source === 'STRIPE')
    const hasNonStripeMembership = subscriptions.some(
        (item) => item.source !== 'STRIPE',
    )
    const activeSubscriptionCount = subscriptions.filter(
        (item) => item.status === 'ACTIVE',
    ).length
    const highestLevel =
        access !== null && access.activeLevels.length > 0
            ? [...access.activeLevels].sort((a, b) => b.sortOrder - a.sortOrder)[0]
            : null

    return (
        <PageStack className="page-container">
            <PageHeader
                title="Konto"
                description="Profil, Zugang, private Feeds und Benachrichtigungen."
            />
            {isLoading && <p className="text-sm text-muted-foreground">Wird geladen…</p>}
            {error !== null && (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {me !== null && access !== null ? (
                <section className="grid gap-3 sm:grid-cols-3">
                    <StatCard
                        hint="Aktive Mitgliedschaften und Freischaltungen."
                        label="Mitgliedschaften"
                        value={String(activeSubscriptionCount)}
                    />
                    <StatCard
                        hint="Schaltet alle Inhalte bis zu dieser Stufe frei."
                        label="Dein Zugang"
                        value={highestLevel?.title ?? 'Kostenlos'}
                    />
                    <StatCard
                        hint="Schalten Bonusdateien und Extras frei."
                        label="Pakete"
                        value={String(access.activePackages.length)}
                    />
                </section>
            ) : null}

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
                                <TableHead scope="row">Rolle</TableHead>
                                <TableCell>
                                    {me.roles.map(roleLabel).join(', ')}
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                    </ResponsiveTable>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <FeatureCard
                            description="Freie und freigeschaltete Folgen."
                            title="Podcast"
                        >
                            <Link className="text-sm font-medium underline-offset-4 hover:underline" href="/episodes">
                                Folgen ansehen
                            </Link>
                        </FeatureCard>
                        <FeatureCard
                            description="Öffentliche und private RSS-Feeds."
                            title="Feeds"
                        >
                            <Link className="text-sm font-medium underline-offset-4 hover:underline" href="/feeds">
                                Feeds verwalten
                            </Link>
                        </FeatureCard>
                        <FeatureCard
                            description="Mitgliedschaft erweitern oder wechseln."
                            title="Preise"
                        >
                            <Link className="text-sm font-medium underline-offset-4 hover:underline" href="/pricing">
                                Tarife ansehen
                            </Link>
                        </FeatureCard>
                        <FeatureCard
                            description="Dateien aus deinem Abo."
                            title="Bonusdateien"
                        >
                            <Link className="text-sm font-medium underline-offset-4 hover:underline" href="/downloads">
                                Downloads öffnen
                            </Link>
                        </FeatureCard>
                    </div>
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
                        description="Freie Folgen und Beiträge sind ohne Abo hör- und lesbar. Mit einer Stufe schaltest du zusätzlich alle bezahlten Inhalte bis zu deiner Stufe frei. Pakete schalten Bonusdateien und Extras frei."
                        title="Dein Zugang"
                    />
                    {highestLevel !== null ? (
                        <p className="text-sm">
                            Dein Zugang:{' '}
                            <strong>{highestLevel.title}</strong> — schaltet alle
                            bezahlten Inhalte bis einschließlich dieser Stufe frei.
                        </p>
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            Noch kein Zugang zu bezahlten Inhalten —{' '}
                            <Link href="/pricing">Tarife ansehen</Link>
                        </p>
                    )}
                    <SectionHeader as="h3" title="Freigeschaltete Stufen" />
                    {access.activeLevels.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            Keine — <Link href="/pricing">Mitgliedschaft wählen</Link>
                        </p>
                    ) : (
                        <ul className="flex flex-col gap-2">
                            {access.activeLevels.map((level) => (
                                <li
                                    className="rounded-xl border bg-card p-4"
                                    key={level.id}
                                >
                                    <p className="font-medium">{level.title}</p>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        Schaltet alle bezahlten Inhalte bis
                                        einschließlich dieser Stufe frei.
                                    </p>
                                </li>
                            ))}
                        </ul>
                    )}
                    <SectionHeader as="h3" title="Freigeschaltete Pakete" />
                    {access.activePackages.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Keine Pakete freigeschaltet.</p>
                    ) : (
                        <ul className="flex flex-col gap-2">
                            {access.activePackages.map((pkg) => (
                                <li
                                    className="rounded-xl border bg-card p-4"
                                    key={pkg.id}
                                >
                                    <p className="font-medium">{pkg.title}</p>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        Schaltet Bonusdateien und Extras dieses
                                        Pakets frei.{' '}
                                        <Link
                                            className="font-medium text-foreground underline-offset-4 hover:underline"
                                            href="/downloads"
                                        >
                                            Downloads öffnen
                                        </Link>
                                    </p>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            )}

            <section className="flex flex-col gap-4">
                <SectionHeader
                    description="Welche Mitgliedschaften aktiv sind, wie lange sie laufen und wo du sie verwalten kannst."
                    title="Mitgliedschaften"
                />
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
                                <TableHead scope="col">Laufzeit</TableHead>
                                <TableHead scope="col">Quelle</TableHead>
                                <TableHead scope="col">Verwaltung</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {subscriptions.map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell>{item.productTitle}</TableCell>
                                    <TableCell>
                                        <Badge
                                            variant={
                                                item.status === 'PAST_DUE'
                                                    ? 'destructive'
                                                    : item.status === 'ACTIVE'
                                                      ? 'secondary'
                                                      : 'outline'
                                            }
                                        >
                                            {subscriptionStatusLabel(item.status)}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {renewalLabel(item.status, item.endsAt)}
                                    </TableCell>
                                    <TableCell>
                                        {billingSourceLabel(item.source)}
                                    </TableCell>
                                    <TableCell>
                                        {sourceActionLabel(item.source)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    </ResponsiveTable>
                )}
                {hasNonStripeMembership ? (
                    <p className="text-sm text-muted-foreground">
                        Mitgliedschaften über Patreon oder Steady verwaltest du
                        direkt in deinem Konto beim jeweiligen Anbieter. Manuell
                        freigeschaltete Zugänge ändert die Redaktion für dich —
                        melde dich einfach bei uns.
                    </p>
                ) : null}
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
                            <Alert variant="destructive">
                                <AlertDescription role="alert">
                                    {portalMessage}
                                </AlertDescription>
                            </Alert>
                        ) : null}
                    </div>
                ) : null}
            </section>

            <section className="flex flex-col gap-3 rounded-xl border bg-card p-5">
                <SectionHeader
                    description="Deine persönlichen Feed-URLs für Podcast-Apps und Feed-Reader — inklusive Anleitung zum Einrichten."
                    title="Private Feeds"
                />
                <div>
                    <Button nativeButton={false} render={<Link href="/feeds" />}>
                        Feeds verwalten
                    </Button>
                </div>
            </section>

            {emailNotifyAvailable && emailNotificationsEnabled !== null && (
                <section className="flex flex-col gap-3 rounded-xl border bg-card p-5">
                    <SectionHeader title="Benachrichtigungen" />
                    <p className="text-sm text-muted-foreground">
                        E-Mail bei neuen Inhalten:{' '}
                        <Badge variant={emailNotificationsEnabled ? 'secondary' : 'outline'}>
                            {emailNotificationsEnabled ? 'An' : 'Aus'}
                        </Badge>
                    </p>
                    <p className="text-sm text-muted-foreground">
                        Du erhältst eine E-Mail, wenn neue Beiträge oder Folgen
                        veröffentlicht werden und der Creator die Benachrichtigung
                        beim Veröffentlichen aktiviert.
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
                        prefsMessageKind === 'error' ? (
                            <Alert variant="destructive">
                                <AlertDescription role="alert">
                                    {prefsMessage}
                                </AlertDescription>
                            </Alert>
                        ) : (
                            <Alert>
                                <AlertDescription role="status">
                                    {prefsMessage}
                                </AlertDescription>
                            </Alert>
                        )
                    ) : null}
                </section>
            )}

            {me !== null && (
                <section className="flex flex-col gap-3 rounded-xl border bg-card p-5">
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
                        <Alert variant="destructive">
                            <AlertDescription role="alert">
                                {changePasswordState.error}
                            </AlertDescription>
                        </Alert>
                    )}
                    {changePasswordState.success && (
                        <Alert>
                            <AlertDescription role="status">
                                Reset-E-Mail wurde gesendet, sofern das Konto berechtigt ist.
                                {changePasswordState.resetHref !== null && (
                                    <>
                                        {' '}
                                        <Link href={changePasswordState.resetHref}>
                                            Reset-Link öffnen (Entwicklung)
                                        </Link>
                                    </>
                                )}
                            </AlertDescription>
                        </Alert>
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
