'use client'

import {useRouter} from 'next/navigation'
import {useCallback, useEffect, useState} from 'react'

import {
    createPortalSession,
    getAccess,
    getMe,
    getNotificationPreferences,
    getSiteConfig,
    listMyFeeds,
    listMySubscriptions,
    updateNotificationPreferences,
} from '@/lib/api/client'
import {AUTH_REQUIRED} from '@directwerk/api/constants'
import type {Access, Me, SubscriberFeedView, SubscriptionSummary} from '@directwerk/api/types'
import {getClientTenantHost} from '@directwerk/api/tenant'
import {userFacingBillingError} from '@/lib/billing/userFacingBillingError'

export interface AccountDashboardState {
    me: Me | null
    access: Access | null
    feeds: SubscriberFeedView[]
    subscriptions: SubscriptionSummary[]
    publicRssUrl: string | null
    emailNotificationsEnabled: boolean | null
    error: string | null
    isLoading: boolean
    prefsMessage: string | null
    prefsBusy: boolean
    portalMessage: string | null
    portalBusy: boolean
    handleToggleNotifications: (nextValue: boolean) => Promise<void>
    handlePortal: () => Promise<void>
}

export function useAccountDashboard(): AccountDashboardState {
    const router = useRouter()
    const [me, setMe] = useState<Me | null>(null)
    const [access, setAccess] = useState<Access | null>(null)
    const [feeds, setFeeds] = useState<SubscriberFeedView[]>([])
    const [subscriptions, setSubscriptions] = useState<SubscriptionSummary[]>([])
    const [publicRssUrl, setPublicRssUrl] = useState<string | null>(null)
    const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState<
        boolean | null
    >(null)
    const [error, setError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [prefsMessage, setPrefsMessage] = useState<string | null>(null)
    const [prefsBusy, setPrefsBusy] = useState(false)
    const [portalMessage, setPortalMessage] = useState<string | null>(null)
    const [portalBusy, setPortalBusy] = useState(false)

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

    const handleToggleNotifications = useCallback(async (nextValue: boolean) => {
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
    }, [router])

    const handlePortal = useCallback(async () => {
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
            setPortalMessage(userFacingBillingError(requestError, 'portal'))
        } finally {
            setPortalBusy(false)
        }
    }, [router])

    return {
        me,
        access,
        feeds,
        subscriptions,
        publicRssUrl,
        emailNotificationsEnabled,
        error,
        isLoading,
        prefsMessage,
        prefsBusy,
        portalMessage,
        portalBusy,
        handleToggleNotifications,
        handlePortal,
    }
}
