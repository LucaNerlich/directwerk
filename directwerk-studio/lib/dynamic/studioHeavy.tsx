'use client'

import dynamic from 'next/dynamic'

function DeferredLoading({label}: {label: string}): React.JSX.Element {
    return <p className="text-sm text-muted-foreground">{label} wird geladen…</p>
}

/** Page-level editors and media library — client-only, code-split to keep studio routes light. */
export const EpisodeEditor = dynamic(
    () => import('@/components/podcast/EpisodeEditor'),
    {
        loading: () => <DeferredLoading label="Folge" />,
    },
)

export const ArticleEditor = dynamic(
    () => import('@/components/write/ArticleEditor'),
    {
        loading: () => <DeferredLoading label="Beitrag" />,
    },
)

export const MediaLibraryClient = dynamic(
    () => import('@/components/media/MediaLibraryClient'),
    {
        loading: () => <DeferredLoading label="Mediathek" />,
    },
)
