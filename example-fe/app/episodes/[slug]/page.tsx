'use client'

import Link from 'next/link'
import {useParams} from 'next/navigation'
import {useEffect, useState, useSyncExternalStore} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import PageHeader from '@directwerk/ui/components/page-header'

import {listMyEpisodes, listPublicEpisodes} from '@/lib/api/client'
import {AUTH_REQUIRED} from '@/lib/api/errors'
import type {PublicEpisode} from '@/lib/api/types'
import {
    getAccessToken,
    subscribeToTokenStore,
} from '@/lib/auth/tokenStore'
import {formatPublishedAt} from '@/lib/format'
import {useSelectedTenant} from '@/lib/useSelectedTenant'

function readTokenClient(): string | null {
    return getAccessToken()
}

function readTokenServer(): string | null {
    return null
}

export default function EpisodeDetailPage(): React.JSX.Element {
    const params = useParams<{slug: string}>()
    const slug = typeof params.slug === 'string' ? params.slug : ''
    const tenantHost = useSelectedTenant()
    const accessToken = useSyncExternalStore(
        subscribeToTokenStore,
        readTokenClient,
        readTokenServer,
    )
    const isAuthenticated = accessToken !== null
    const [episode, setEpisode] = useState<PublicEpisode | null>(null)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        let active = true
        if (slug.length === 0) {
            setErrorMessage('Episode not found.')
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
                            ? 'Episode not found or you are not entitled to it.'
                            : 'Episode not found in the public catalog. Sign in if this is a paid episode.',
                    )
                }
            })
            .catch((error: unknown) => {
                if (!active) {
                    return
                }
                if (error instanceof Error && error.message === AUTH_REQUIRED) {
                    setErrorMessage('Session expired — please sign in again.')
                    return
                }
                setErrorMessage(
                    error instanceof Error
                        ? error.message
                        : 'Unable to load episode.',
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
    }, [tenantHost, isAuthenticated, slug])

    return (
        <div className="page-container space-y-6">
            <Link
                className="text-sm text-muted-foreground hover:text-foreground"
                href="/episodes"
            >
                ← All episodes
            </Link>
            {isLoading ? <p>Loading…</p> : null}
            {errorMessage !== null ? (
                <Alert variant="destructive">
                    <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
            ) : null}
            {episode !== null ? (
                <>
                    <PageHeader
                        title={
                            <>
                                {episode.episodeNumber !== null
                                    ? `#${episode.episodeNumber} `
                                    : ''}
                                {episode.title}
                            </>
                        }
                        description={`${episode.seriesSlug} · ${episode.accessPolicy} · ${formatPublishedAt(episode.publishedAt)}`}
                    />
                    {episode.formats.length > 0 ? (
                        <p className="text-sm">
                            Formats:{' '}
                            {episode.formats.map((format) => format.name).join(', ')}
                        </p>
                    ) : null}
                    {episode.categories.length > 0 ? (
                        <p className="text-sm">
                            Categories:{' '}
                            {episode.categories.map((category) => category.name).join(', ')}
                        </p>
                    ) : null}
                    {episode.description !== null && episode.description.length > 0 ? (
                        <div
                            className="editorial-copy"
                            dangerouslySetInnerHTML={{__html: episode.description}}
                        />
                    ) : null}
                    {episode.audioCdnUrl !== null ? (
                        <audio
                            className="media-player"
                            controls
                            preload="metadata"
                            src={episode.audioCdnUrl}
                        >
                            Audio unavailable
                        </audio>
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            {episode.accessPolicy === 'PAID'
                                ? isAuthenticated
                                    ? 'No playable audio for this entitled episode yet.'
                                    : 'Sign in to play this paid episode if you have access.'
                                : 'No audio URL available.'}
                        </p>
                    )}
                </>
            ) : null}
        </div>
    )
}
