'use client'

import dynamic from 'next/dynamic'

function DeferredLoading({label}: {label: string}): React.JSX.Element {
    return <p className="text-sm text-muted-foreground">{label} wird geladen…</p>
}

/** TipTap rich-text editor — client-only, ~100KB+ gzipped with extensions. */
export const ShowNotesEditor = dynamic(
    () => import('@/components/editors/ShowNotesEditor'),
    {
        ssr: false,
        loading: () => <DeferredLoading label="Editor" />,
    },
)

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
