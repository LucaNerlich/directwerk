'use client'

import Link from 'next/link'
import {useSyncExternalStore} from 'react'

import PageHeader from '@directwerk/ui/components/page-header'
import SectionHeader from '@directwerk/ui/components/section-header'

import AccessPolicyBadge from '@/components/AccessPolicyBadge'
import CatalogMediaThumb from '@/components/CatalogMediaThumb'
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
import {formatDuration} from '@/lib/format/content'
import {formatPublishedAt} from '@/lib/format/dateTime'
import {useDictionary, useLocale} from '@/lib/i18n/LocaleProvider'
import {localizedPath} from '@/lib/i18n/paths'
import {getWebClientTenantHost} from '@/lib/tenant/clientHost'

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
    const lang = useLocale()
    const {catalog, common, format} = useDictionary()
    const messages = {
        emptySlug: catalog.episodeNotFound,
        loadFailed: catalog.episodeLoadFailed,
        authRequired: catalog.episodeAuthRequired,
    }
    const tenantHost = getWebClientTenantHost()
    const accessToken = useSyncExternalStore(
        subscribeToTokenStore,
        readTokenClient,
        readTokenServer,
    )
    const isAuthenticated = accessToken !== null
    const products = usePublicProducts(tenantHost)
    const unlockTarget = unlockHref(findUnlockProduct(products), lang)
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
        messages,
    })

    const title =
        episode !== null
            ? `${episode.episodeNumber !== null ? `#${episode.episodeNumber} ` : ''}${episode.title}`
            : ''
    const isLocked = episode !== null && episode.audioCdnUrl === null
    const hasEmptySlug = slug.length === 0

    return (
        <DetailShell
            backHref={localizedPath(lang, '/episodes')}
            backLabel={catalog.backEpisodes}
            isLoading={status === 'loading' && !hasEmptySlug}
            isAuthenticated={isAuthenticated}
            errorMessage={
                hasEmptySlug
                    ? messages.emptySlug
                    : status === 'error'
                      ? errorMessage
                      : null
            }
            onRetry={retry}
            notFound={
                status === 'not-found' && !hasEmptySlug
                    ? {
                          title: catalog.episodeUnavailableTitle,
                          description: isAuthenticated
                              ? catalog.episodeUnavailableAuth
                              : catalog.episodeUnavailableGuest,
                      }
                    : null
            }
            unlockHref={unlockTarget}
        >
            {episode !== null ? (
                <article className="max-w-3xl space-y-6">
                    <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
                        <CatalogMediaThumb
                            alt={episode.title}
                            priority
                            size="lg"
                            src={episode.coverImageUrl}
                        />
                        <div className="min-w-0 flex-1">
                            <PageHeader
                                className="border-b-0 pb-0"
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
                                            episode.formats.length > 0
                                                ? episode.formats
                                                      .map((format) => format.name)
                                                      .join(', ')
                                                : null,
                                            formatPublishedAt(episode.publishedAt, lang, format),
                                            formatDuration(episode.durationSeconds),
                                        ]}
                                    />
                                }
                                title={title}
                            />
                        </div>
                    </div>
                    <section className="flex flex-col gap-3 rounded-xl border bg-card p-5">
                        <SectionHeader title={common.player} />
                        {episode.audioCdnUrl !== null ? (
                            <audio
                                className="media-player w-full"
                                controls
                                onPlay={() => trackEpisodePlay(episode.slug)}
                                preload="metadata"
                                src={episode.audioCdnUrl}
                            >
                                {catalog.audioUnavailable}
                            </audio>
                        ) : episode.accessPolicy === 'PAID' ? (
                            <DetailLockedPanel
                                title={catalog.lockedEpisodeTitle}
                                description={
                                    isAuthenticated ? (
                                        catalog.lockedEpisodeDescAuth
                                    ) : (
                                        <>
                                            {catalog.lockedEpisodeDescGuestBefore}
                                            <Link href={localizedPath(lang, '/login')}>
                                                {catalog.lockedEpisodeLoginLink}
                                            </Link>
                                            {catalog.lockedEpisodeDescGuestAfter}
                                        </>
                                    )
                                }
                                isAuthenticated={isAuthenticated}
                                unlockHref={unlockTarget}
                            />
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                {catalog.noPublicAudioUrl}
                            </p>
                        )}
                    </section>

                    {episode.description !== null && episode.description.length > 0 ? (
                        <div
                            className="content-prose"
                            // Defense-in-depth: the API sanitizes on write, but
                            // stored HTML is re-sanitized here so a compromised
                            // or bypassed record cannot XSS the public site.
                            dangerouslySetInnerHTML={{__html: sanitizeContentHtml(episode.description)}}
                        />
                    ) : null}
                </article>
            ) : null}
        </DetailShell>
    )
}
