'use client'

import Link from 'next/link'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Badge} from '@directwerk/ui/components/badge'
import {Button} from '@directwerk/ui/components/button'
import EmptyState from '@directwerk/ui/components/empty-state'
import ListPanel, {ListPanelRow} from '@directwerk/ui/components/list-panel'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'
import SectionHeader from '@directwerk/ui/components/section-header'

import {usePublicCatalog} from '@/lib/catalog/usePublicCatalog'
import {useSubscriberAuth} from '@/lib/auth/useSubscriberAuth'
import type {PublicEpisode} from '@directwerk/api/types'
import {formatPublishedAt} from '@directwerk/api/format/datetime'
import {getClientTenantHost} from '@directwerk/api/tenant'

function accessPolicyLabel(policy: PublicEpisode['accessPolicy']): string {
    return policy === 'PAID' ? 'Bezahlt' : 'Frei'
}

export default function EpisodesPage() {
    const tenantHost = getClientTenantHost()
    const {isAuthenticated} = useSubscriberAuth()
    const {siteConfig, series, episodes, errorMessage, isLoading} = usePublicCatalog({
        tenantHost,
        isAuthenticated,
    })

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
                                    const feedUrl = item.rssUrl
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
