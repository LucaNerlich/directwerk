'use client'

import {useEffect, useState} from 'react'

import {AUTH_REQUIRED} from '@directwerk/api/constants'
import type {PublicEpisode, PublicSeries, PublicSiteConfig} from '@directwerk/api/types'

import {
    getSiteConfig,
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
    authRequiredMessage?: string
    loadErrorMessage?: string
}

export function usePublicCatalog({
    tenantHost,
    isAuthenticated,
    authRequiredMessage = 'Sitzung abgelaufen — bitte erneut anmelden, um freigeschaltete Folgen zu hören.',
    loadErrorMessage = 'Podcast-Inhalte konnten nicht geladen werden.',
}: PublicCatalogOptions): PublicCatalogState {
    const [siteConfig, setSiteConfig] = useState<PublicSiteConfig | null>(null)
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

        Promise.all([
            getSiteConfig(tenantHost),
            listPublicSeries(tenantHost),
            episodesPromise,
        ])
            .then(([configEnvelope, seriesList, episodeList]) => {
                if (!active) {
                    return
                }
                setSiteConfig(configEnvelope.data)
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
