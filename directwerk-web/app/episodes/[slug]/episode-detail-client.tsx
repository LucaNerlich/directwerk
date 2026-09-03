'use client'

import Link from 'next/link'
import {useEffect, useState, useSyncExternalStore} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'
import SectionHeader from '@directwerk/ui/components/section-header'

import AccessPolicyBadge from '@/components/AccessPolicyBadge'
import ContentMetaLine from '@/components/ContentMetaLine'
import {listMyEpisodes, listPublicEpisodes} from '@/lib/api/client'
import {sanitizeContentHtml} from '@/lib/sanitizeContentHtml'
import {AUTH_REQUIRED} from '@directwerk/api/constants'
import type {PublicEpisode} from '@directwerk/api/types'
import {
    getAccessToken,
    subscribeToTokenStore,
} from '@/lib/auth/tokenStore'
import {formatPublishedAt} from '@directwerk/api/format/datetime'
import {formatDuration} from '@/lib/format/content'
import {getClientTenantHost} from '@/lib/tenant/clientHost'

function readTokenClient(): string | null {
    return getAccessToken()
}

function readTokenServer(): string | null {
    return null
}

export default function EpisodeDetailClient({
    slug,
    initialPublicEpisode = null,
}: {
    slug: string
    /** Preloaded public catalog entry rendered server-side; skips the public fetch. */
    initialPublicEpisode?: PublicEpisode | null
}): React.JSX.Element {
    const tenantHost = getClientTenantHost()
    const accessToken = useSyncExternalStore(
        subscribeToTokenStore,
        readTokenClient,
        readTokenServer,
    )
    const isAuthenticated = accessToken !== null
    const [episode, setEpisode] = useState<PublicEpisode | null>(
        initialPublicEpisode,
    )
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(initialPublicEpisode === null)

    useEffect(() => {
        let active = true
        if (slug.length === 0) {
            setErrorMessage('Folge nicht gefunden.')
            setIsLoading(false)
            return
        }

        // A preloaded public episode is already rendered — only subscribers
        // need a (re-)fetch against their entitled catalog.
        if (initialPublicEpisode !== null && !isAuthenticated) {
            setIsLoading(false)
            return
        }

        setIsLoading(true)
        setErrorMessage(null)

        const load = isAuthenticated
            ? listMyEpisodes(tenantHost)
            : listPublicEpisodes(tenantHost)

        load
            .then((episodes) => {
                if (!active) {
                    return
                }
                const match = episodes.find((item) => item.slug === slug) ?? null
                setEpisode(match)
                if (match === null) {
                    setErrorMessage(
                        isAuthenticated
                            ? 'Folge nicht gefunden oder nicht freigeschaltet.'
                            : 'Folge nicht im öffentlichen Katalog. Bei bezahlten Folgen bitte anmelden.',
                    )
                }
            })
            .catch((error: unknown) => {
                if (!active) {
                    return
                }
                if (error instanceof Error && error.message === AUTH_REQUIRED) {
                    setErrorMessage('Sitzung abgelaufen — bitte erneut anmelden.')
                    return
                }
                setErrorMessage(
                    error instanceof Error
                        ? error.message
                        : 'Folge konnte nicht geladen werden.',
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
    }, [tenantHost, isAuthenticated, slug, initialPublicEpisode])

    const title =
        episode !== null
            ? `${episode.episodeNumber !== null ? `#${episode.episodeNumber} ` : ''}${episode.title}`
            : ''

    return (
        <PageStack className="page-container">
            <Link className="text-sm text-muted-foreground hover:text-foreground" href="/episodes">
                ← Alle Folgen
            </Link>
            {isLoading ? <p className="text-sm text-muted-foreground">Wird geladen…</p> : null}
            {errorMessage !== null ? (
                <Alert variant="destructive">
                    <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
            ) : null}

            {episode !== null ? (
                <article className="max-w-3xl space-y-6">
                    <PageHeader
                        actions={<AccessPolicyBadge policy={episode.accessPolicy} />}
                        description={
                            <ContentMetaLine
                                items={[
                                    episode.seriesSlug,
                                    formatPublishedAt(episode.publishedAt),
                                    formatDuration(episode.durationSeconds),
                                ]}
                            />
                        }
                        title={title}
                    />
                    {episode.description !== null && episode.description.length > 0 ? (
                        <div
                            className="content-prose"
                            // Defense-in-depth: the API sanitizes on write, but
                            // stored HTML is re-sanitized here so a compromised
                            // or bypassed record cannot XSS the public site.
                            dangerouslySetInnerHTML={{__html: sanitizeContentHtml(episode.description)}}
                        />
                    ) : null}

                    <section className="flex flex-col gap-3 rounded-xl border bg-card p-5">
                        <SectionHeader title="Player" />
                        {episode.audioCdnUrl !== null ? (
                            <audio
                                className="media-player w-full"
                                controls
                                preload="metadata"
                                src={episode.audioCdnUrl}
                            >
                                Audio nicht verfügbar
                            </audio>
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                {episode.accessPolicy === 'PAID' ? (
                                    isAuthenticated ? (
                                        <>
                                            Kein abspielbares Audio — fehlende
                                            Freischaltung oder Datei.{' '}
                                            <Link href="/pricing">Tarife ansehen</Link>
                                        </>
                                    ) : (
                                        <>
                                            Bezahlte Folge —{' '}
                                            <Link href="/login">anmelden</Link>, um sie
                                            freizuschalten.
                                        </>
                                    )
                                ) : (
                                    'Noch keine öffentliche Audio-URL.'
                                )}
                            </p>
                        )}
                    </section>
                </article>
            ) : null}
        </PageStack>
    )
}
