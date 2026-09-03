'use client'

import {useRouter} from 'next/navigation'
import {useCallback, useEffect, useState} from 'react'

import {
    createPortalSession,
    getAccess,
    getMe,
    getNotificationPreferences,
    getSiteConfig,
    listMyArticleFeeds,
    listMyFeeds,
    listMySubscriptions,
    updateNotificationPreferences,
} from '@/lib/api/client'
import {AUTH_REQUIRED} from '@directwerk/api/constants'
import type {
    Access,
    ArticleFeedView,
    Me,
    SubscriberFeedView,
    SubscriptionSummary,
} from '@directwerk/api/types'
import {getClientTenantHost} from '@/lib/tenant/clientHost'
import {userFacingBillingError} from '@/lib/billing/userFacingBillingError'

export interface AccountDashboardState {
    me: Me | null
    access: Access | null
    feeds: SubscriberFeedView[]
    articleFeeds: ArticleFeedView[]
    subscriptions: SubscriptionSummary[]
    publicRssUrl: string | null
    publicArticleRssUrl: string | null
    emailNotificationsEnabled: boolean | null
    emailNotifyAvailable: boolean
    error: string | null
    isLoading: boolean
    prefsMessage: string | null
    prefsMessageKind: 'success' | 'error' | null
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
    const [articleFeeds, setArticleFeeds] = useState<ArticleFeedView[]>([])
    const [subscriptions, setSubscriptions] = useState<SubscriptionSummary[]>([])
    const [publicRssUrl, setPublicRssUrl] = useState<string | null>(null)
    const [publicArticleRssUrl, setPublicArticleRssUrl] = useState<string | null>(null)
    const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState<
        boolean | null
    >(null)
    const [emailNotifyAvailable, setEmailNotifyAvailable] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [prefsMessage, setPrefsMessage] = useState<string | null>(null)
    const [prefsMessageKind, setPrefsMessageKind] = useState<
        'success' | 'error' | null
    >(null)
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
            listMySubscriptions(tenantHost),
            getSiteConfig(tenantHost),
        ])
            .then(async ([meResponse, accessResponse, prefs, subscriptionList, siteConfig]) => {
                const hasSubscriptions =
                    siteConfig.data.enabledModules.includes('SUBSCRIPTION')
                const podcastFeedsPromise: Promise<SubscriberFeedView[]> =
                    hasSubscriptions &&
                    siteConfig.data.enabledModules.includes('PODCAST_RSS')
                        ? listMyFeeds(tenantHost)
                        : Promise.resolve([])
                const articleFeedsPromise: Promise<ArticleFeedView[]> =
                    hasSubscriptions &&
                    siteConfig.data.enabledModules.includes('ARTICLE_RSS')
                        ? listMyArticleFeeds(tenantHost)
                        : Promise.resolve([])
                const [podcastFeedsResult, articleFeedsResult] =
                    await Promise.allSettled([
                        podcastFeedsPromise,
                        articleFeedsPromise,
                    ])
                const authFailure = [podcastFeedsResult, articleFeedsResult].find(
                    (result): result is PromiseRejectedResult =>
                        result.status === 'rejected' &&
                        result.reason instanceof Error &&
                        result.reason.message === AUTH_REQUIRED,
                )
                if (authFailure !== undefined) {
                    throw authFailure.reason
                }

                const feedError =
                    podcastFeedsResult.status === 'rejected' ||
                    articleFeedsResult.status === 'rejected'
                        ? 'Einige private Feeds konnten nicht geladen werden.'
                        : null

                const feedList =
                    podcastFeedsResult.status === 'fulfilled'
                        ? podcastFeedsResult.value
                        : []
                const articleFeedList =
                    articleFeedsResult.status === 'fulfilled'
                        ? articleFeedsResult.value
                        : []

                return {
                    meResponse,
                    accessResponse,
                    prefs,
                    subscriptionList,
                    siteConfig,
                    feedList,
                    articleFeedList,
                    feedError,
                }
            })
            .then(({
                meResponse,
                accessResponse,
                prefs,
                subscriptionList,
                siteConfig,
                feedList,
                articleFeedList,
                feedError,
            }) => {
                if (isCurrent) {
                    setMe(meResponse.data)
                    setAccess(accessResponse.data)
                    setEmailNotificationsEnabled(prefs.emailNotificationsEnabled)
                    setEmailNotifyAvailable(prefs.emailNotifyAvailable)
                    setFeeds(feedList)
                    setArticleFeeds(articleFeedList)
                    setSubscriptions(subscriptionList)
                    setPublicRssUrl(siteConfig.data.publicRssUrl ?? null)
                    setPublicArticleRssUrl(
                        siteConfig.data.publicArticleRssUrl ?? null,
                    )
                    setError(feedError)
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

                setError(userFacingBillingError(requestError, 'account'))
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
        if (!emailNotifyAvailable && nextValue) {
            return
        }
        setPrefsBusy(true)
        setPrefsMessage(null)
        setPrefsMessageKind(null)
        try {
            const result = await updateNotificationPreferences(
                getClientTenantHost(),
                nextValue,
            )
            setEmailNotificationsEnabled(result.emailNotificationsEnabled)
            setPrefsMessage('Benachrichtigungen gespeichert.')
            setPrefsMessageKind('success')
        } catch (requestError: unknown) {
            if (
                requestError instanceof Error &&
                requestError.message === AUTH_REQUIRED
            ) {
                router.replace('/login')
                return
            }
            setPrefsMessage(userFacingBillingError(requestError, 'preferences'))
            setPrefsMessageKind('error')
        } finally {
            setPrefsBusy(false)
        }
    }, [emailNotifyAvailable, router])

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
        articleFeeds,
        subscriptions,
        publicRssUrl,
        publicArticleRssUrl,
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
    }
}
