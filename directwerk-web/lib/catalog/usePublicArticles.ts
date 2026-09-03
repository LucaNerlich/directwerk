'use client'

import {useEffect, useState} from 'react'

import {AUTH_REQUIRED} from '@directwerk/api/constants'
import type {PublicArticle, PublicSiteConfig} from '@directwerk/api/types'

import {
    getSiteConfig,
    listMyArticles,
    listPublicArticles,
} from '@/lib/api/client'

export interface PublicArticlesState {
    siteConfig: PublicSiteConfig | null
    articles: PublicArticle[]
    errorMessage: string | null
    isLoading: boolean
}

export interface PublicArticlesOptions {
    tenantHost: string
    isAuthenticated: boolean
    authRequiredMessage?: string
    loadErrorMessage?: string
}

/**
 * Article counterpart to `usePublicCatalog`: site config plus the entitled
 * article list for subscribers, the public list otherwise.
 */
export function usePublicArticles({
    tenantHost,
    isAuthenticated,
    authRequiredMessage = 'Sitzung abgelaufen — bitte erneut anmelden, um freigeschaltete Beiträge zu lesen.',
    loadErrorMessage = 'Beiträge konnten nicht geladen werden.',
}: PublicArticlesOptions): PublicArticlesState {
    const [siteConfig, setSiteConfig] = useState<PublicSiteConfig | null>(null)
    const [articles, setArticles] = useState<PublicArticle[]>([])
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        let active = true
        setIsLoading(true)
        setErrorMessage(null)

        const articlesPromise = isAuthenticated
            ? listMyArticles(tenantHost)
            : listPublicArticles(tenantHost)

        Promise.all([getSiteConfig(tenantHost), articlesPromise])
            .then(([configEnvelope, articleList]) => {
                if (!active) {
                    return
                }
                setSiteConfig(configEnvelope.data)
                setArticles(articleList)
            })
            .catch((error: unknown) => {
                if (!active) {
                    return
                }
                setArticles([])
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

    return {siteConfig, articles, errorMessage, isLoading}
}
