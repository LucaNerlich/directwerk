'use client'

import Form from 'next/form'
import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useActionState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Badge} from '@directwerk/ui/components/badge'
import {Button} from '@directwerk/ui/components/button'
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
import {CardGridSkeleton} from '@/components/ContentLoadingSkeleton'
import {forgotPassword} from '@/lib/api/client'
import {parseForgotPasswordInput} from '@directwerk/api/validation/input'
import {
    billingSourceLabel,
    subscriptionStatusLabel,
} from '@/lib/format/content'
import {userFacingGeneralError} from '@/lib/billing/userFacingBillingError'
import {formatPublishedAt} from '@/lib/format/dateTime'
import type {Locale} from '@/lib/i18n/config'
import type {Dictionary} from '@/lib/i18n/dictionary'
import {interpolate} from '@/lib/i18n/interpolate'
import {useDictionary, useLocale} from '@/lib/i18n/LocaleProvider'
import {localizedPath} from '@/lib/i18n/paths'

import {clearSessionTokens} from '@/lib/auth/session'
import {getWebClientTenantHost} from '@/lib/tenant/clientHost'

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

function roleLabel(role: string, format: Dictionary['format']): string {
    switch (role) {
        case 'SUBSCRIBER':
            return format.roleSubscriber
        case 'TENANT_ADMIN':
            return format.roleTenantAdmin
        case 'EDITOR':
            return format.roleEditor
        case 'PLATFORM_ADMIN':
            return format.rolePlatformAdmin
        case 'GUEST':
            return format.roleGuest
        default:
            return role
    }
}

/**
 * Human-readable role summary. `GUEST` is the implicit fallback role and is
 * hidden whenever the account holds a real role, so invited users do not read
 * as "Gast, Mitglied".
 */
const ROLE_ORDER: readonly string[] = [
    'PLATFORM_ADMIN',
    'TENANT_ADMIN',
    'EDITOR',
    'SUBSCRIBER',
]

function roleSummary(roles: readonly string[], format: Dictionary['format']): string {
    const meaningful = roles.filter((role) => role !== 'GUEST')
    if (meaningful.length === 0) {
        return roleLabel('GUEST', format)
    }
    const ordered = ROLE_ORDER.filter((role) => meaningful.includes(role))
    const rest = meaningful.filter((role) => !ROLE_ORDER.includes(role))
    return [...ordered, ...rest].map((role) => roleLabel(role, format)).join(', ')
}

function renewalLabel(
    status: string,
    endsAt: string | null,
    lang: Locale,
    format: Dictionary['format'],
): string {
    if (endsAt !== null) {
        const date = formatPublishedAt(endsAt, lang, format)
        if (status === 'CANCELED') {
            return interpolate(format.renewalEnded, {date})
        }
        return interpolate(format.renewalUntil, {date})
    }
    if (status === 'ACTIVE') {
        return format.renewalOngoing
    }
    if (status === 'PAST_DUE') {
        return format.renewalOverdue
    }
    return '—'
}

function sourceActionLabel(source: string, account: Dictionary['account']): string {
    switch (source) {
        case 'STRIPE':
            return account.sourceStripe
        case 'PATREON':
            return account.sourcePatreon
        case 'STEADY':
            return account.sourceSteady
        case 'MANUAL':
            return account.sourceManual
        default:
            return account.sourceDefault
    }
}

export default function AccountPage() {
    const router = useRouter()
    const lang = useLocale()
    const {account, common, errors, format, nav} = useDictionary()
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
                        'X-Tenant-Host': getWebClientTenantHost(),
                    },
                    body: '{}',
                })
            } catch {
                // Ignore — clear local session regardless.
            }
            clearSessionTokens()
            router.replace(localizedPath(lang, '/login'))
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
                        error: account.emailUnavailable,
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
                            process.env.NODE_ENV !== 'production' &&
                            result.devResetToken !== null
                                ? `${localizedPath(lang, '/reset-password')}?token=${encodeURIComponent(result.devResetToken)}`
                                : null,
                    }
                } catch (requestError: unknown) {
                    return {
                        error: userFacingGeneralError(
                            requestError,
                            account.passwordChangeFailed,
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
                title={account.title}
                description={account.description}
            />
            {isLoading && (
                <div aria-busy="true" aria-label={common.loadingAccount} role="status">
                    <CardGridSkeleton cards={3} columns={3} />
                </div>
            )}
            {error !== null && (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {me !== null && access !== null ? (
                <section className="grid gap-3 sm:grid-cols-3">
                    <StatCard
                        hint={account.membershipsHint}
                        label={account.membershipsStat}
                        value={String(activeSubscriptionCount)}
                    />
                    <StatCard
                        hint={account.accessHint}
                        label={account.accessStat}
                        value={highestLevel?.title ?? account.freeAccess}
                    />
                    <StatCard
                        hint={account.packagesHint}
                        label={account.packagesStat}
                        value={String(access.activePackages.length)}
                    />
                </section>
            ) : null}

            {me !== null && (
                <section className="flex flex-col gap-4">
                    <SectionHeader title={account.profileTitle} />
                    <ResponsiveTable label={account.profileTable}>
                    <Table>
                        <TableBody>
                            <TableRow>
                                <TableHead scope="row">{common.email}</TableHead>
                                <TableCell>{me.email}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableHead scope="row">{common.name}</TableHead>
                                <TableCell>{me.name ?? account.nameNotSet}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableHead scope="row">{account.role}</TableHead>
                                <TableCell>
                                    {roleSummary(me.roles, format)}
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                    </ResponsiveTable>
                </section>
            )}

            {hasPastDue ? (
                <Alert variant="destructive">
                    <AlertDescription>
                        {account.pastDueAlert}
                    </AlertDescription>
                </Alert>
            ) : null}

            {access !== null && (
                <section className="flex flex-col gap-4">
                    <SectionHeader
                        description={account.accessDescription}
                        title={account.accessTitle}
                    />
                    {highestLevel !== null ? (
                        <p className="text-sm">
                            {account.accessLevelLine}{' '}
                            <strong>{highestLevel.title}</strong>
                            {account.accessLevelSuffix}
                        </p>
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            {account.noPaidAccess}{' '}
                            <Link href={localizedPath(lang, '/pricing')}>{nav.viewPlans}</Link>
                        </p>
                    )}
                    <SectionHeader as="h3" title={account.unlockedLevelsTitle} />
                    {access.activeLevels.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            {common.noneDash}{' '}
                            <Link href={localizedPath(lang, '/pricing')}>{nav.chooseMembership}</Link>
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
                                        {account.levelUnlockHint}
                                    </p>
                                </li>
                            ))}
                        </ul>
                    )}
                    <SectionHeader as="h3" title={account.unlockedPackagesTitle} />
                    {access.activePackages.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{account.noPackages}</p>
                    ) : (
                        <ul className="flex flex-col gap-2">
                            {access.activePackages.map((pkg) => (
                                <li
                                    className="rounded-xl border bg-card p-4"
                                    key={pkg.id}
                                >
                                    <p className="font-medium">{pkg.title}</p>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        {account.packageUnlockHint}{' '}
                                        <Link
                                            className="font-medium text-foreground underline-offset-4 hover:underline"
                                            href={localizedPath(lang, '/downloads')}
                                        >
                                            {account.openDownloads}
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
                    description={account.subscriptionsDescription}
                    title={account.subscriptionsTitle}
                />
                {subscriptions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        {account.noSubscriptions}{' '}
                        <Link href={localizedPath(lang, '/pricing')}>{nav.chooseMembership}</Link>
                    </p>
                ) : (
                    <ResponsiveTable label={account.subscriptionsTitle}>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead scope="col">{common.product}</TableHead>
                                <TableHead scope="col">{common.status}</TableHead>
                                <TableHead scope="col">{common.term}</TableHead>
                                <TableHead scope="col">{common.source}</TableHead>
                                <TableHead scope="col">{common.management}</TableHead>
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
                                            {subscriptionStatusLabel(item.status, format)}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {renewalLabel(item.status, item.endsAt, lang, format)}
                                    </TableCell>
                                    <TableCell>
                                        {billingSourceLabel(item.source, format)}
                                    </TableCell>
                                    <TableCell>
                                        {sourceActionLabel(item.source, account)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    </ResponsiveTable>
                )}
                {hasNonStripeMembership ? (
                    <p className="text-sm text-muted-foreground">
                        {account.externalMembershipHint}
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
                                  ? account.portalUpdateCard
                                  : account.portalManage}
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

            {emailNotifyAvailable && emailNotificationsEnabled !== null && (
                <section className="flex flex-col gap-3 rounded-xl border bg-card p-5">
                    <SectionHeader title={account.notificationsTitle} />
                    <p className="text-sm text-muted-foreground">
                        {account.emailNotifyLabel}{' '}
                        <Badge variant={emailNotificationsEnabled ? 'secondary' : 'outline'}>
                            {emailNotificationsEnabled ? common.on : common.off}
                        </Badge>
                    </p>
                    <p className="text-sm text-muted-foreground">
                        {account.emailNotifyHelp}
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
                              ? common.deactivate
                              : common.activate}
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
                    <SectionHeader title={account.passwordTitle} />
                    <p className="text-sm text-muted-foreground">
                        {account.passwordHelp} <strong>{me.email}</strong>.
                    </p>
                    <Form action={changePasswordAction}>
                        <input type="hidden" name="email" value={me.email} />
                        <Button
                            type="submit"
                            disabled={isChangingPassword || changePasswordState.success}
                        >
                            {isChangingPassword
                                ? account.passwordSending
                                : account.passwordSubmit}
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
                                {account.passwordResetSent}
                                {changePasswordState.resetHref !== null && (
                                    <>
                                        {' '}
                                        <Link href={changePasswordState.resetHref}>
                                            {account.devResetLink}
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
                    {isLoggingOut ? nav.logoutPending : nav.logout}
                </Button>
            </Form>
            <p className="text-sm text-muted-foreground">
                <Link href={localizedPath(lang, '/')}>{nav.toHome}</Link>
            </p>
        </PageStack>
    )
}
