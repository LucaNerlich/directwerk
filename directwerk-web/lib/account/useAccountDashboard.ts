'use client'

import {useRouter} from 'next/navigation'
import {useCallback, useEffect, useState} from 'react'

import {
    createPortalSession,
    getAccess,
    getMe,
    getNotificationPreferences,
    getSiteConfig,
    listMySubscriptions,
    updateNotificationPreferences,
} from '@/lib/api/client'
import {AUTH_REQUIRED} from '@directwerk/api/constants'
import type {Access, Me, SubscriptionSummary} from '@directwerk/api/types'
import {getWebClientTenantHost} from '@/lib/tenant/clientHost'
import {userFacingBillingError} from '@/lib/billing/userFacingBillingError'
import {useDictionary, useLocale} from '@/lib/i18n/LocaleProvider'
import {localizedPath} from '@/lib/i18n/paths'

export interface AccountDashboardState {
    me: Me | null
    access: Access | null
    subscriptions: SubscriptionSummary[]
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

/**
 * Loads the signed-in account's profile, access, notification preferences, and
 * module-gated subscriptions. Authentication failures redirect to login; the
 * returned handlers persist notification changes and open the billing portal.
 */
export function useAccountDashboard(): AccountDashboardState {
    const router = useRouter()
    const lang = useLocale()
    const dictionary = useDictionary()
    const {errors} = dictionary
    const [me, setMe] = useState<Me | null>(null)
    const [access, setAccess] = useState<Access | null>(null)
    const [subscriptions, setSubscriptions] = useState<SubscriptionSummary[]>([])
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
        const tenantHost = getWebClientTenantHost()
        Promise.all([
            getMe(tenantHost),
            getAccess(tenantHost),
            getNotificationPreferences(tenantHost),
            getSiteConfig(tenantHost),
        ])
            .then(async ([meResponse, accessResponse, prefs, siteConfig]) => {
                // Subscriptions live behind the SUBSCRIPTION module: only call
                // the endpoint when it is active so a disabled module cannot
                // fail the whole account page with FEATURE_NOT_ENABLED.
                const subscriptionList: SubscriptionSummary[] =
                    siteConfig.data.enabledModules.includes('SUBSCRIPTION')
                        ? await listMySubscriptions(tenantHost)
                        : []

                return {
                    meResponse,
                    accessResponse,
                    prefs,
                    subscriptionList,
                }
            })
            .then(({meResponse, accessResponse, prefs, subscriptionList}) => {
                if (isCurrent) {
                    setMe(meResponse.data)
                    setAccess(accessResponse.data)
                    setEmailNotificationsEnabled(prefs.emailNotificationsEnabled)
                    setEmailNotifyAvailable(prefs.emailNotifyAvailable)
                    setSubscriptions(subscriptionList)
                    setError(null)
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
                    router.replace(localizedPath(lang, '/login'))
                    return
                }

                setError(userFacingBillingError(requestError, 'account', errors))
            })
            .finally(() => {
                if (isCurrent) {
                    setIsLoading(false)
                }
            })

        return () => {
            isCurrent = false
        }
    }, [errors, lang, router])

    const handleToggleNotifications = useCallback(async (nextValue: boolean) => {
        if (!emailNotifyAvailable && nextValue) {
            return
        }
        setPrefsBusy(true)
        setPrefsMessage(null)
        setPrefsMessageKind(null)
        try {
            const result = await updateNotificationPreferences(
                getWebClientTenantHost(),
                nextValue,
            )
            setEmailNotificationsEnabled(result.emailNotificationsEnabled)
            setPrefsMessage(dictionary.account.notificationsSaved)
            setPrefsMessageKind('success')
        } catch (requestError: unknown) {
            if (
                requestError instanceof Error &&
                requestError.message === AUTH_REQUIRED
            ) {
                router.replace(localizedPath(lang, '/login'))
                return
            }
            setPrefsMessage(userFacingBillingError(requestError, 'preferences', errors))
            setPrefsMessageKind('error')
        } finally {
            setPrefsBusy(false)
        }
    }, [dictionary.account.notificationsSaved, emailNotifyAvailable, errors, lang, router])

    const handlePortal = useCallback(async () => {
        setPortalBusy(true)
        setPortalMessage(null)
        try {
            const returnUrl = `${window.location.origin}${localizedPath(lang, '/account')}`
            const portalUrl = await createPortalSession(
                getWebClientTenantHost(),
                returnUrl,
            )
            if (portalUrl === null) {
                setPortalMessage(errors.portalUnavailable)
                return
            }
            window.location.assign(portalUrl)
        } catch (requestError: unknown) {
            if (
                requestError instanceof Error &&
                requestError.message === AUTH_REQUIRED
            ) {
                router.replace(localizedPath(lang, '/login'))
                return
            }
            setPortalMessage(userFacingBillingError(requestError, 'portal', errors))
        } finally {
            setPortalBusy(false)
        }
    }, [errors, lang, router])

    return {
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
    }
}
