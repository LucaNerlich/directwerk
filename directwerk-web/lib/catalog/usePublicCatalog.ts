'use client'

import {useSiteConfig} from '@/lib/site/SiteConfigProvider'
import {userFacingGeneralError} from '@/lib/billing/userFacingBillingError'

import {useEffect, useState} from 'react'

import {AUTH_REQUIRED} from '@directwerk/api/constants'
import type {PublicSiteConfig} from '@directwerk/api/types'

export interface PublicCatalogOptions<T, S = never> {
    tenantHost: string
    isAuthenticated: boolean
    authRequiredMessage: string
    loadErrorMessage: string
    /** Entitled list for signed-in subscribers. */
    loadMine: () => Promise<T[]>
    /** Public list for visitors. */
    loadPublic: () => Promise<T[]>
    /** Optional second list loaded alongside the items (e.g. podcast series). */
    loadSeries?: () => Promise<S[]>
}

export interface PublicCatalogState<T, S = never> {
    siteConfig: PublicSiteConfig
    items: T[]
    series: S[]
    errorMessage: string | null
    isLoading: boolean
}

/**
 * Shared loader for the public catalog pages (episodes, articles): site config plus the
 * entitled list for subscribers and the public list otherwise (issue #575).
 */
export function usePublicCatalog<T, S = never>({
    tenantHost,
    isAuthenticated,
    authRequiredMessage,
    loadErrorMessage,
    loadMine,
    loadPublic,
    loadSeries,
}: PublicCatalogOptions<T, S>): PublicCatalogState<T, S> {
    // Issue #434: the [lang] layout already provides the site config; re-fetching it here cost a
    // public GET per page view and created a second source of truth for enabledModules.
    const siteConfig = useSiteConfig()
    const [series, setSeries] = useState<S[]>([])
    const [items, setItems] = useState<T[]>([])
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        let active = true
        setIsLoading(true)
        setErrorMessage(null)

        const itemsPromise = isAuthenticated ? loadMine() : loadPublic()
        const seriesPromise = loadSeries ? loadSeries() : Promise.resolve<S[]>([])

        Promise.all([seriesPromise, itemsPromise])
            .then(([seriesList, itemList]) => {
                if (!active) {
                    return
                }
                setSeries(seriesList)
                setItems(itemList)
            })
            .catch((error: unknown) => {
                if (!active) {
                    return
                }
                setSeries([])
                setItems([])
                if (error instanceof Error && error.message === AUTH_REQUIRED) {
                    setErrorMessage(authRequiredMessage)
                    return
                }
                // #555: never surface raw backend/transport text to visitors — the same rule
                // the pricing page follows via userFacingBillingError.
                setErrorMessage(userFacingGeneralError(error, loadErrorMessage))
            })
            .finally(() => {
                if (active) {
                    setIsLoading(false)
                }
            })

        return () => {
            active = false
        }
    }, [
        authRequiredMessage,
        isAuthenticated,
        loadErrorMessage,
        tenantHost,
        loadMine,
        loadPublic,
        loadSeries,
    ])

    return {siteConfig, items, series, errorMessage, isLoading}
}
