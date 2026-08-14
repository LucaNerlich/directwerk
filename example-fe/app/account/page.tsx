'use client'

import Form from 'next/form'
import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useActionState, useEffect, useState} from 'react'

import {Alert, AlertDescription} from '@publish/ui/components/alert'
import {Button} from '@publish/ui/components/button'
import PageHeader from '@publish/ui/components/page-header'
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from '@publish/ui/components/table'

import {
    createPortalSession,
    forgotPassword,
    getAccess,
    getMe,
    listMyFeeds,
    listMySubscriptions,
} from '@/lib/api/client'
import {AUTH_REQUIRED} from '@/lib/api/errors'
import type {Access, Me, SubscriberFeed, SubscriptionSummary} from '@/lib/api/types'
import {parseForgotPasswordInput} from '@/lib/api/validation'
import {clearTokens} from '@/lib/auth/tokenStore'
import {getSelectedTenant} from '@/lib/tenantStore'

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
    const [subscriptions, setSubscriptions] = useState<SubscriptionSummary[]>([])
    const [feeds, setFeeds] = useState<SubscriberFeed[]>([])
    const [portalMessage, setPortalMessage] = useState<string | null>(null)
    const [portalBusy, setPortalBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [, logoutAction, isLoggingOut] = useActionState(
        async (): Promise<LogoutState> => {
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
                        error: 'Account email is not available.',
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
                                : 'Could not start the password change.',
                        success: false,
                        resetHref: null,
                    }
                }
            },
            CHANGE_PASSWORD_INITIAL,
        )

    useEffect(() => {
        let isCurrent = true
        const tenantHost = getSelectedTenant()
        Promise.all([
            getMe(tenantHost),
            getAccess(tenantHost),
            listMySubscriptions(tenantHost).catch(() => []),
            listMyFeeds(tenantHost).catch(() => []),
        ])
            .then(([meResponse, accessResponse, subscriptionList, feedList]) => {
                if (isCurrent) {
                    setMe(meResponse.data)
                    setAccess(accessResponse.data)
                    setSubscriptions(subscriptionList)
                    setFeeds(feedList)
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
                        : 'Unable to load the account.',
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

    async function handlePortal(): Promise<void> {
        setPortalBusy(true)
        setPortalMessage(null)
        try {
            const returnUrl = `${window.location.origin}/account`
            const portalUrl = await createPortalSession(getSelectedTenant(), returnUrl)
            if (portalUrl === null) {
                setPortalMessage('Customer portal is not available.')
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
                    : 'Could not open the customer portal.'
            setPortalMessage(
                message.toLowerCase().includes('not implemented')
                    ? 'Stripe is not configured on this API.'
                    : message,
            )
        } finally {
            setPortalBusy(false)
        }
    }

    const hasPastDue = subscriptions.some((item) => item.status === 'PAST_DUE')
    const hasStripeMembership = subscriptions.some((item) => item.source === 'STRIPE')

    return (
        <div className="page-container space-y-8">
            <PageHeader
                title="Account"
                description="Profile, entitlements, subscriptions, and private feeds."
            />
            {isLoading && <p>Loading…</p>}
            {error !== null && (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {me !== null && (
                <section>
                    <h2>Profile</h2>
                    <Table>
                        <TableBody>
                            <TableRow>
                                <TableHead scope="row">Email</TableHead>
                                <TableCell>{me.email}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableHead scope="row">Name</TableHead>
                                <TableCell>{me.name ?? 'Not set'}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableHead scope="row">Roles</TableHead>
                                <TableCell>{me.roles.join(', ')}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableHead scope="row">Tenant ID</TableHead>
                                <TableCell>{me.tenantId}</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </section>
            )}

            {hasPastDue ? (
                <Alert variant="destructive">
                    <AlertDescription>
                        A payment failed. Access is paused until you update the card
                        in the customer portal.
                    </AlertDescription>
                </Alert>
            ) : null}

            {access !== null && (
                <section className="space-y-4">
                    <h2>Access</h2>
                    <Table>
                        <TableBody>
                            <TableRow>
                                <TableHead scope="row">Roles</TableHead>
                                <TableCell>{access.roles.join(', ')}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableHead scope="row">Max LEVEL sort</TableHead>
                                <TableCell>
                                    {access.maxLevelSortOrder ?? 'None'}
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                    <h3>Active levels</h3>
                    {access.activeLevels.length === 0 ? (
                        <p>None</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead scope="col">Title</TableHead>
                                    <TableHead scope="col">Slug</TableHead>
                                    <TableHead scope="col">Sort order</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {access.activeLevels.map((level) => (
                                    <TableRow key={level.id}>
                                        <TableCell>{level.title}</TableCell>
                                        <TableCell>{level.slug}</TableCell>
                                        <TableCell>{level.sortOrder}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                    <h3>Active packages</h3>
                    {access.activePackages.length === 0 ? (
                        <p>None</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead scope="col">Title</TableHead>
                                    <TableHead scope="col">Slug</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {access.activePackages.map((item) => (
                                    <TableRow key={item.id}>
                                        <TableCell>{item.title}</TableCell>
                                        <TableCell>{item.slug}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </section>
            )}

            <section className="space-y-3">
                <h2>Subscriptions</h2>
                {subscriptions.length === 0 ? (
                    <p>
                        None.{' '}
                        <Link href="/pricing">View products</Link>
                    </p>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead scope="col">Product</TableHead>
                                <TableHead scope="col">Type</TableHead>
                                <TableHead scope="col">Status</TableHead>
                                <TableHead scope="col">Source</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {subscriptions.map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell>{item.productTitle}</TableCell>
                                    <TableCell>{item.offeringType}</TableCell>
                                    <TableCell>{item.status}</TableCell>
                                    <TableCell>{item.source}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
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
                                  ? 'Update card'
                                  : 'Manage billing in customer portal'}
                        </Button>
                        {portalMessage !== null ? (
                            <p role="status">{portalMessage}</p>
                        ) : null}
                    </div>
                ) : null}
            </section>

            <section className="space-y-3">
                <h2>Private feeds</h2>
                {feeds.length === 0 ? (
                    <p>
                        None yet.{' '}
                        <Link href="/feeds">Open feeds</Link>
                    </p>
                ) : (
                    <ul className="space-y-2">
                        {feeds.map((feed) => (
                            <li key={feed.id}>
                                <strong>
                                    {feed.title}
                                    {feed.isDefault ? ' (default)' : ''}
                                </strong>
                                {feed.enabled ? (
                                    <p>
                                        <a href={feed.url} rel="noreferrer">
                                            {feed.url}
                                        </a>
                                    </p>
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        Disabled
                                    </p>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
                <p className="text-sm text-muted-foreground">
                    Manage enable/rotate on the <Link href="/feeds">Feeds</Link> page.
                </p>
            </section>

            {me !== null && (
                <section>
                    <h2>Password</h2>
                    <p>
                        Request a reset email for <strong>{me.email}</strong>. Use
                        the link in Mailpit (or the email) to choose a new password.
                    </p>
                    <Form action={changePasswordAction}>
                        <input type="hidden" name="email" value={me.email} />
                        <Button
                            type="submit"
                            disabled={isChangingPassword || changePasswordState.success}
                        >
                            {isChangingPassword
                                ? 'Sending…'
                                : 'Send password reset email'}
                        </Button>
                    </Form>
                    {changePasswordState.error !== null && (
                        <p role="alert">{changePasswordState.error}</p>
                    )}
                    {changePasswordState.success && (
                        <p role="status">
                            Reset email sent if the account is eligible.
                            {changePasswordState.resetHref !== null && (
                                <>
                                    {' '}
                                    <Link href={changePasswordState.resetHref}>
                                        Open reset link (dev)
                                    </Link>
                                </>
                            )}
                        </p>
                    )}
                </section>
            )}

            <Form action={logoutAction}>
                <Button type="submit" variant="outline" disabled={isLoggingOut}>
                    {isLoggingOut ? 'Logging out…' : 'Logout'}
                </Button>
            </Form>
            <p>
                <Link href="/">Back to tenant selection</Link>
            </p>
        </div>
    )
}
