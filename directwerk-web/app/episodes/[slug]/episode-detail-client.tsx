'use client'

import Link from 'next/link'
import {useSyncExternalStore} from 'react'

import PageHeader from '@directwerk/ui/components/page-header'
import SectionHeader from '@directwerk/ui/components/section-header'

import AccessPolicyBadge from '@/components/AccessPolicyBadge'
import ContentMetaLine from '@/components/ContentMetaLine'
import DetailShell, {DetailLockedPanel} from '@/components/DetailShell'
import {listMyEpisodes, listPublicEpisodes} from '@/lib/api/client'
import {trackEpisodePlay} from '@/lib/analytics/umamiTrack'
import {sanitizeContentHtml} from '@/lib/sanitizeContentHtml'
import {
    getAccessToken,
    subscribeToTokenStore,
} from '@/lib/auth/tokenStore'
import {useEntitledDetail} from '@/lib/catalog/useEntitledDetail'
import {findUnlockProduct, unlockHref} from '@/lib/catalog/unlock'
import {usePublicProducts} from '@/lib/catalog/usePublicProducts'
import type {PublicEpisode} from '@directwerk/api/types'
import {formatPublishedAt} from '@directwerk/api/format/datetime'
import {formatDuration} from '@/lib/format/content'
import {getWebClientTenantHost} from '@/lib/tenant/clientHost'

function readTokenClient(): string | null {
    return getAccessToken()
}

function readTokenServer(): string | null {
    return null
}

const MESSAGES = {
    emptySlug: 'Folge nicht gefunden.',
    loadFailed: 'Folge konnte nicht geladen werden.',
    authRequired: 'Sitzung abgelaufen — bitte erneut anmelden.',
} as const

export default function EpisodeDetailClient({
    slug,
    initialPublicEpisode = null,
}: {
    slug: string
    /** Preloaded public catalog entry rendered server-side; skips the public fetch. */
    initialPublicEpisode?: PublicEpisode | null
}): React.JSX.Element {
    const tenantHost = getWebClientTenantHost()
    const accessToken = useSyncExternalStore(
        subscribeToTokenStore,
        readTokenClient,
        readTokenServer,
    )
    const isAuthenticated = accessToken !== null
    const products = usePublicProducts(tenantHost)
    const unlockTarget = unlockHref(findUnlockProduct(products))
    const {item: episode, status, errorMessage, retry} = useEntitledDetail<PublicEpisode>({
        slug,
        initial: initialPublicEpisode,
        isAuthenticated,
        tenantHost,
        // No single-episode metadata endpoint exists (only list + stream /
        // download), so episodes keep the catalog scan.
        loadPublic: async () =>
            (await listPublicEpisodes(tenantHost)).find((item) => item.slug === slug) ??
            null,
        loadEntitled: async () =>
            (await listMyEpisodes(tenantHost)).find((item) => item.slug === slug) ?? null,
        messages: MESSAGES,
    })

    const title =
        episode !== null
            ? `${episode.episodeNumber !== null ? `#${episode.episodeNumber} ` : ''}${episode.title}`
            : ''
    const isLocked = episode !== null && episode.audioCdnUrl === null
    const hasEmptySlug = slug.length === 0

    return (
        <DetailShell
            backHref="/episodes"
            backLabel="← Alle Folgen"
            isLoading={status === 'loading' && !hasEmptySlug}
            isAuthenticated={isAuthenticated}
            errorMessage={
                hasEmptySlug
                    ? MESSAGES.emptySlug
                    : status === 'error'
                      ? errorMessage
                      : null
            }
            onRetry={retry}
            notFound={
                status === 'not-found' && !hasEmptySlug
                    ? {
                          title: 'Folge nicht verfügbar',
                          description: isAuthenticated
                              ? 'Diese Folge wurde nicht gefunden oder ist nicht für dich freigeschaltet. Eine Mitgliedschaft schaltet bezahlte Folgen frei.'
                              : 'Diese Folge ist nicht im öffentlichen Katalog. Bezahlte Folgen erscheinen nach der Anmeldung mit aktiver Mitgliedschaft.',
                      }
                    : null
            }
            unlockHref={unlockTarget}
        >
            {episode !== null ? (
                <article className="max-w-3xl space-y-6">
                    <PageHeader
                        actions={
                            <AccessPolicyBadge
                                policy={episode.accessPolicy}
                                isEntitled={
                                    episode.accessPolicy === 'PAID'
                                        ? !isLocked
                                        : undefined
                                }
                            />
                        }
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
                                onPlay={() => trackEpisodePlay(episode.slug)}
                                preload="metadata"
                                src={episode.audioCdnUrl}
                            >
                                Audio nicht verfügbar
                            </audio>
                        ) : episode.accessPolicy === 'PAID' ? (
                            <DetailLockedPanel
                                title="Mitgliedschaft nötig"
                                description={
                                    isAuthenticated ? (
                                        <>
                                            Kein abspielbares Audio — fehlende
                                            Freischaltung oder Datei. Eine
                                            Mitgliedschaft schaltet bezahlte Folgen
                                            frei.
                                        </>
                                    ) : (
                                        <>
                                            Bezahlte Folge —{' '}
                                            <Link href="/login">anmelden</Link>, um sie
                                            freizuschalten.
                                        </>
                                    )
                                }
                                isAuthenticated={isAuthenticated}
                                unlockHref={unlockTarget}
                            />
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                Noch keine öffentliche Audio-URL.
                            </p>
                        )}
                    </section>
                </article>
            ) : null}
        </DetailShell>
    )
}
