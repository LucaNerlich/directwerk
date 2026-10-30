'use client'

import {useEffect, useState} from 'react'

import LocaleLink from '@/components/i18n/LocaleLink'
import {useDictionary} from '@/components/i18n/LocaleProvider'
import {getMediaReferences} from '@/lib/api/mediaApi'
import {assetTypeLabel, mediaStatusLabel, visibilityLabel} from '@/lib/subscription/displayLabels'
import {formatBytes} from '@directwerk/api/format/bytes'
import type {MediaAsset, MediaAssetReference} from '@directwerk/api/types'
import {Badge} from '@directwerk/ui/components/badge'
import {Button} from '@directwerk/ui/components/button'
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from '@directwerk/ui/components/sheet'

function studioHrefForReference(ref: MediaAssetReference): string | null {
    switch (ref.kind) {
        case 'EPISODE_AUDIO':
        case 'EPISODE_COVER':
        case 'MEDIA_EPISODE_LINK':
            return `/podcast/episodes/${ref.id}`
        case 'SERIES_COVER':
            return `/podcast/series/${ref.id}`
        case 'FORMAT_COVER':
            return `/podcast/formats/${ref.id}`
        case 'ARTICLE_HERO':
            return `/write/articles/${ref.id}`
        case 'DIGITAL_PUBLICATION':
            return `/bonus/${ref.id}`
        default:
            return null
    }
}

function kindLabel(kind: string, dict: ReturnType<typeof useDictionary>['media']): string {
    switch (kind) {
        case 'EPISODE_AUDIO':
            return dict.referenzEpisodeAudio
        case 'EPISODE_COVER':
            return dict.referenzEpisodeCover
        case 'SERIES_COVER':
            return dict.referenzSeriesCover
        case 'FORMAT_COVER':
            return dict.referenzFormatCover
        case 'ARTICLE_HERO':
            return dict.referenzArticleHero
        case 'DIGITAL_PUBLICATION':
            return dict.referenzDigitalPublication
        case 'MEDIA_EPISODE_LINK':
            return dict.referenzMediaEpisodeLink
        default:
            return kind
    }
}

interface MediaAssetDetailPanelProps {
    asset: MediaAsset | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

export default function MediaAssetDetailPanel({
    asset,
    open,
    onOpenChange,
}: MediaAssetDetailPanelProps): React.JSX.Element {
    const dict = useDictionary()
    const [references, setReferences] = useState<MediaAssetReference[] | null>(null)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)

    const assetId = asset?.id

    useEffect(() => {
        if (!open || assetId === undefined) {
            return
        }
        let cancelled = false
        setIsLoading(true)
        setErrorMessage(null)
        setReferences(null)
        void getMediaReferences(assetId)
            .then((rows) => {
                if (!cancelled) {
                    setReferences(rows)
                }
            })
            .catch((error: unknown) => {
                if (!cancelled) {
                    setErrorMessage(
                        error instanceof Error
                            ? error.message
                            : dict.media.referenzenKonnteNichtGeladen,
                    )
                    // Keep references null so the unused empty state does not render with the alert.
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setIsLoading(false)
                }
            })
        return () => {
            cancelled = true
        }
    }, [open, assetId, dict.media.referenzenKonnteNichtGeladen])

    const title =
        asset !== null
            ? (asset.originalFilename ?? `Asset #${asset.id}`)
            : dict.media.dateidetails

    return (
        <Sheet onOpenChange={onOpenChange} open={open}>
            <SheetContent
                className="w-full overflow-y-auto sm:max-w-lg"
                closeLabel={dict.media.schliessen}
                side="right"
            >
                <SheetHeader>
                    <SheetTitle>{title}</SheetTitle>
                    <SheetDescription>{dict.media.dateidetailsBeschreibung}</SheetDescription>
                </SheetHeader>

                <div className="flex flex-col gap-4 px-4">
                    {asset !== null ? (
                        <dl className="grid gap-2 text-sm">
                            <div className="flex justify-between gap-4">
                                <dt className="text-muted-foreground">{dict.media.referenzMetaTyp}</dt>
                                <dd>{assetTypeLabel(asset.assetType)}</dd>
                            </div>
                            <div className="flex justify-between gap-4">
                                <dt className="text-muted-foreground">{dict.media.referenzMetaStatus}</dt>
                                <dd>{mediaStatusLabel(asset.status)}</dd>
                            </div>
                            <div className="flex justify-between gap-4">
                                <dt className="text-muted-foreground">{dict.media.referenzMetaSichtbarkeit}</dt>
                                <dd>{visibilityLabel(asset.visibility)}</dd>
                            </div>
                            <div className="flex justify-between gap-4">
                                <dt className="text-muted-foreground">{dict.media.referenzMetaGroesse}</dt>
                                <dd>{formatBytes(asset.sizeBytes) ?? '—'}</dd>
                            </div>
                        </dl>
                    ) : null}

                    <section aria-labelledby="media-references-heading" className="space-y-3">
                        <h3 className="text-sm font-medium" id="media-references-heading">
                            {dict.media.verwendungen}
                        </h3>
                        {isLoading ? (
                            <p className="text-sm text-muted-foreground" role="status">
                                {dict.media.referenzenWerdenGeladen}
                            </p>
                        ) : null}
                        {errorMessage !== null ? (
                            <p className="text-sm text-destructive" role="alert">
                                {errorMessage}
                            </p>
                        ) : null}
                        {!isLoading && references !== null && references.length === 0 ? (
                            <div className="rounded-md border border-dashed px-3 py-4 text-sm">
                                <p className="font-medium">{dict.media.keineVerwendungen}</p>
                                <p className="mt-1 text-muted-foreground">
                                    {dict.media.keineVerwendungenHinweis}
                                </p>
                            </div>
                        ) : null}
                        {!isLoading && references !== null && references.length > 0 ? (
                            <ul className="divide-y rounded-md border">
                                {references.map((ref) => {
                                    const href = studioHrefForReference(ref)
                                    return (
                                        <li
                                            className="flex items-start justify-between gap-3 px-3 py-2"
                                            key={`${ref.kind}-${ref.id}`}
                                        >
                                            <div className="min-w-0 space-y-1">
                                                <Badge variant="outline">
                                                    {kindLabel(ref.kind, dict.media)}
                                                </Badge>
                                                {href !== null ? (
                                                    <LocaleLink
                                                        className="block truncate text-sm font-medium underline-offset-2 hover:underline"
                                                        href={href}
                                                    >
                                                        {ref.title || `#${ref.id}`}
                                                    </LocaleLink>
                                                ) : (
                                                    <p className="truncate text-sm font-medium">
                                                        {ref.title || `#${ref.id}`}
                                                    </p>
                                                )}
                                            </div>
                                        </li>
                                    )
                                })}
                            </ul>
                        ) : null}
                        <p className="text-xs text-muted-foreground">
                            {dict.media.referenzenHtmlHinweis}
                        </p>
                    </section>
                </div>

                <SheetFooter>
                    <Button onClick={() => onOpenChange(false)} type="button" variant="outline">
                        {dict.media.schliessen}
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    )
}
