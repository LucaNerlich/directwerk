'use client'

import {useSiteConfig} from '@/lib/site/SiteConfigProvider'

import {useEffect, useState} from 'react'

import {AUTH_REQUIRED} from '@directwerk/api/constants'
import type {PublicEpisode, PublicSeries, PublicSiteConfig} from '@directwerk/api/types'

import {
    listMyEpisodes,
    listPublicEpisodes,
    listPublicSeries,
} from '@/lib/api/client'

export interface PublicCatalogState {
    siteConfig: PublicSiteConfig | null
    series: PublicSeries[]
    episodes: PublicEpisode[]
    errorMessage: string | null
    isLoading: boolean
}

export interface PublicCatalogOptions {
    tenantHost: string
    isAuthenticated: boolean
    authRequiredMessage: string
    loadErrorMessage: string
}

export function usePublicCatalog({
    tenantHost,
    isAuthenticated,
    authRequiredMessage,
    loadErrorMessage,
}: PublicCatalogOptions): PublicCatalogState {
    // Issue #434: the [lang] layout already provides the site config; re-fetching it here cost a
    // public GET per page view and created a second source of truth for enabledModules.
    const siteConfig = useSiteConfig()
    const [series, setSeries] = useState<PublicSeries[]>([])
    const [episodes, setEpisodes] = useState<PublicEpisode[]>([])
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        let active = true
        setIsLoading(true)
        setErrorMessage(null)

        const episodesPromise = isAuthenticated
            ? listMyEpisodes(tenantHost)
            : listPublicEpisodes(tenantHost)

        Promise.all([listPublicSeries(tenantHost), episodesPromise])
            .then(([seriesList, episodeList]) => {
                if (!active) {
                    return
                }
                setSeries(seriesList)
                setEpisodes(episodeList)
            })
            .catch((error: unknown) => {
                if (!active) {
                    return
                }
                setSeries([])
                setEpisodes([])
                if (error instanceof Error && error.message === AUTH_REQUIRED) {
                    setErrorMessage(authRequiredMessage)
                    return
                }
                setErrorMessage(
                    error instanceof Error ? error.message : loadErrorMessage,
                )
            })
            .finally(() => {
                if (active) {
                    setIsLoading(false)
                }
            })

        return () => {
            active = false
        }
    }, [authRequiredMessage, isAuthenticated, loadErrorMessage, tenantHost])

    return {siteConfig, series, episodes, errorMessage, isLoading}
}
