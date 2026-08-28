'use client'

import Link from 'next/link'
import {useEffect, useState, useSyncExternalStore} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Badge} from '@directwerk/ui/components/badge'
import {Button} from '@directwerk/ui/components/button'
import EmptyState from '@directwerk/ui/components/empty-state'
import ListPanel, {ListPanelRow} from '@directwerk/ui/components/list-panel'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'
import SectionHeader from '@directwerk/ui/components/section-header'

import {getSiteConfig, listMyEpisodes, listPublicEpisodes, listPublicSeries} from '@/lib/api/client'
import {AUTH_REQUIRED} from '@directwerk/api/constants'
import type {PublicEpisode, PublicSeries, PublicSiteConfig} from '@directwerk/api/types'
import {
    getAccessToken,
    subscribeToTokenStore,
} from '@/lib/auth/tokenStore'
import {formatPublishedAt} from '@/lib/format'
import {publicSeriesFeedUrl} from '@/lib/feeds'
import {getClientTenantHost} from '@/lib/tenant/getClientTenantHost'

function readTokenClient(): string | null {
    return getAccessToken()
}

function readTokenServer(): string | null {
    return null
}

function accessPolicyLabel(policy: PublicEpisode['accessPolicy']): string {
    return policy === 'PAID' ? 'Bezahlt' : 'Frei'
}

export default function EpisodesPage() {
    const tenantHost = getClientTenantHost()
    const accessToken = useSyncExternalStore(
        subscribeToTokenStore,
        readTokenClient,
        readTokenServer,
    )
    const [series, setSeries] = useState<PublicSeries[]>([])
    const [episodes, setEpisodes] = useState<PublicEpisode[]>([])
    const [siteConfig, setSiteConfig] = useState<PublicSiteConfig | null>(null)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const isAuthenticated = accessToken !== null

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
                    setErrorMessage(
                        'Sitzung abgelaufen — bitte erneut anmelden, um freigeschaltete Folgen zu hören.',
                    )
                    return
                }
                setErrorMessage(
                    error instanceof Error
                        ? error.message
                        : 'Podcast-Inhalte konnten nicht geladen werden.',
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
    }, [tenantHost, isAuthenticated])

    return (
        <PageStack className="page-container">
            <PageHeader
                title="Folgen"
                description={
                    isAuthenticated
                        ? 'Angemeldet: freie und für dich freigeschaltete Folgen.'
                        : 'Öffentlich: nur freie Folgen. Anmelden für bezahlte Inhalte.'
                }
            />
            {isLoading ? (
                <p className="text-sm text-muted-foreground">Wird geladen…</p>
            ) : null}
            {errorMessage !== null ? (
                <Alert variant="destructive">
                    <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
            ) : null}

            {!isLoading && errorMessage === null ? (
                <>
                    <section className="flex flex-col gap-4">
                        <SectionHeader title="Sendungen" />
                        {series.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                Noch keine veröffentlichten Sendungen.
                            </p>
                        ) : (
                            <ListPanel>
                                {series.map((item) => {
                                    const feedUrl =
                                        siteConfig === null
                                            ? null
                                            : publicSeriesFeedUrl(
                                                  tenantHost,
                                                  siteConfig.tenant.slug,
                                                  item.slug,
                                              )
                                    return (
                                        <ListPanelRow key={item.id}>
                                            <div className="min-w-0 flex-1">
                                                <p className="font-medium">{item.title}</p>
                                                <p className="mt-1 text-sm text-muted-foreground">
                                                    {item.slug}
                                                    {item.language !== null
                                                        ? ` · ${item.language}`
                                                        : ''}
                                                </p>
                                                {feedUrl !== null ? (
                                                    <p className="mt-2 break-all text-sm">
                                                        <a href={feedUrl} rel="noreferrer">
                                                            {feedUrl}
                                                        </a>
                                                    </p>
                                                ) : null}
                                            </div>
                                        </ListPanelRow>
                                    )
                                })}
                            </ListPanel>
                        )}
                    </section>

                    <section className="flex flex-col gap-4">
                        <SectionHeader title="Veröffentlichte Folgen" />
                        {episodes.length === 0 ? (
                            <EmptyState
                                description={
                                    isAuthenticated
                                        ? 'Keine veröffentlichten Folgen, auf die du Zugriff hast.'
                                        : 'Noch keine veröffentlichten Folgen.'
                                }
                                title="Keine Folgen"
                            />
                        ) : (
                            <ListPanel>
                                {episodes.map((episode) => (
                                    <ListPanelRow key={episode.id}>
                                        <div className="min-w-0 flex-1">
                                            <Link
                                                className="font-medium hover:underline"
                                                href={`/episodes/${encodeURIComponent(episode.slug)}`}
                                            >
                                                {episode.episodeNumber !== null
                                                    ? `#${episode.episodeNumber} `
                                                    : ''}
                                                {episode.title}
                                            </Link>
                                            <p className="mt-1 text-sm text-muted-foreground">
                                                {episode.seriesSlug} ·{' '}
                                                {accessPolicyLabel(episode.accessPolicy)} ·{' '}
                                                {formatPublishedAt(episode.publishedAt)}
                                            </p>
                                        </div>
                                        <div className="flex shrink-0 items-center gap-2">
                                            <Badge variant="outline">
                                                {accessPolicyLabel(episode.accessPolicy)}
                                            </Badge>
                                            {episode.audioCdnUrl !== null ? (
                                                <Button
                                                    nativeButton={false}
                                                    render={
                                                        <Link
                                                            href={`/episodes/${encodeURIComponent(episode.slug)}`}
                                                        />
                                                    }
                                                    size="sm"
                                                    variant="outline"
                                                >
                                                    Anhören
                                                </Button>
                                            ) : (
                                                <span className="text-xs text-muted-foreground">
                                                    {episode.accessPolicy === 'PAID'
                                                        ? isAuthenticated
                                                            ? 'Freischaltung prüfen'
                                                            : 'Anmelden für Zugang'
                                                        : 'Kein Audio'}
                                                </span>
                                            )}
                                        </div>
                                    </ListPanelRow>
                                ))}
                            </ListPanel>
                        )}
                    </section>
                </>
            ) : null}
        </PageStack>
    )
}
