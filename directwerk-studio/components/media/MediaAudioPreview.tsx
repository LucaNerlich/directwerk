'use client'

import {useEffect, useRef, useState} from 'react'

import {Button} from '@directwerk/ui/components/button'

import {getMediaPreviewUrl} from '@/lib/api/mediaApi'
import {safeImageSrc} from '@/lib/url/safeUrl'

const PREVIEW_FETCH_CONCURRENCY = 4

type QueueEntry = {
    assetId: number
    resolve: (url: string) => void
    reject: (error: unknown) => void
}

const inflightByAssetId = new Map<number, Promise<string>>()
const waitQueue: QueueEntry[] = []
let activeFetches = 0

function pumpPreviewQueue(): void {
    while (activeFetches < PREVIEW_FETCH_CONCURRENCY && waitQueue.length > 0) {
        const next = waitQueue.shift()
        if (next === undefined) {
            return
        }
        activeFetches += 1
        void getMediaPreviewUrl(next.assetId)
            .then((url) => {
                next.resolve(url)
            })
            .catch((error: unknown) => {
                next.reject(error)
            })
            .finally(() => {
                activeFetches -= 1
                inflightByAssetId.delete(next.assetId)
                pumpPreviewQueue()
            })
    }
}

/**
 * Lazily requests a media preview URL with in-flight dedupe and a small
 * concurrency cap so a long library page of private audio does not stampede
 * the preview-url endpoint.
 */
export function requestMediaPreviewUrl(assetId: number): Promise<string> {
    const existing = inflightByAssetId.get(assetId)
    if (existing !== undefined) {
        return existing
    }
    let resolvePromise!: (url: string) => void
    let rejectPromise!: (error: unknown) => void
    const promise = new Promise<string>((resolve, reject) => {
        resolvePromise = resolve
        rejectPromise = reject
    })
    inflightByAssetId.set(assetId, promise)
    waitQueue.push({
        assetId,
        resolve: resolvePromise,
        reject: rejectPromise,
    })
    pumpPreviewQueue()
    return promise
}

/** Test-only: clear the shared preview queue between cases. */
export function resetMediaPreviewFetchQueueForTests(): void {
    waitQueue.length = 0
    activeFetches = 0
    inflightByAssetId.clear()
}

export type MediaAudioPreviewProps = {
    assetId: number
    cdnUrl: string | null
    cachedPreviewUrl?: string | null
    status: string
    onPreviewUrl?: (assetId: number, url: string) => void
}

/**
 * Inline audio player for the media library. Public CDN URLs play immediately;
 * private READY assets fetch a preview URL only when the card is near the
 * viewport (or the user clicks “Vorschau laden”).
 */
export default function MediaAudioPreview({
    assetId,
    cdnUrl,
    cachedPreviewUrl = null,
    status,
    onPreviewUrl,
}: MediaAudioPreviewProps): React.JSX.Element {
    const rootRef = useRef<HTMLDivElement>(null)
    const [src, setSrc] = useState<string | null>(
        () => safeImageSrc(cdnUrl) ?? safeImageSrc(cachedPreviewUrl),
    )
    const [isLoading, setIsLoading] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const fetchStartedRef = useRef(src !== null)

    useEffect(() => {
        const next = safeImageSrc(cdnUrl) ?? safeImageSrc(cachedPreviewUrl)
        if (next !== null) {
            setSrc(next)
            fetchStartedRef.current = true
            setErrorMessage(null)
        }
    }, [cdnUrl, cachedPreviewUrl])

    async function loadPreview(): Promise<void> {
        if (fetchStartedRef.current || src !== null || status !== 'READY') {
            return
        }
        fetchStartedRef.current = true
        setIsLoading(true)
        setErrorMessage(null)
        try {
            const url = await requestMediaPreviewUrl(assetId)
            const safe = safeImageSrc(url)
            if (safe === null) {
                fetchStartedRef.current = false
                setErrorMessage('Vorschau-URL ungültig.')
                return
            }
            setSrc(safe)
            onPreviewUrl?.(assetId, safe)
        } catch (error) {
            fetchStartedRef.current = false
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : 'Audio-Vorschau konnte nicht geladen werden.',
            )
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        if (src !== null || status !== 'READY' || fetchStartedRef.current) {
            return
        }
        const node = rootRef.current
        if (node === null) {
            return
        }
        if (typeof IntersectionObserver === 'undefined') {
            return
        }
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    void loadPreview()
                    observer.disconnect()
                }
            },
            {rootMargin: '120px'},
        )
        observer.observe(node)
        return () => {
            observer.disconnect()
        }
    }, [assetId, src, status])

    if (src !== null) {
        return (
            <div className="w-full" ref={rootRef}>
                <audio
                    className="w-full max-w-full"
                    controls
                    preload="metadata"
                    src={src}
                >
                    Audio-Wiedergabe wird nicht unterstützt.
                </audio>
            </div>
        )
    }

    return (
        <div className="flex w-full flex-col gap-2" ref={rootRef}>
            <div className="flex aspect-video items-center justify-center rounded-md bg-muted text-xs font-medium uppercase tracking-wide text-muted-foreground">
                AUDIO
            </div>
            {status === 'READY' ? (
                isLoading ? (
                    <p className="text-xs text-muted-foreground" role="status">
                        Vorschau wird geladen…
                    </p>
                ) : errorMessage !== null ? (
                    <div className="flex flex-col gap-2">
                        <p className="text-xs text-muted-foreground" role="alert">
                            {errorMessage}
                        </p>
                        <Button
                            onClick={() => {
                                void loadPreview()
                            }}
                            size="sm"
                            type="button"
                            variant="outline"
                        >
                            Erneut versuchen
                        </Button>
                    </div>
                ) : (
                    <Button
                        onClick={() => {
                            void loadPreview()
                        }}
                        size="sm"
                        type="button"
                        variant="outline"
                    >
                        Vorschau laden
                    </Button>
                )
            ) : (
                <p className="text-xs text-muted-foreground" role="status">
                    Audio noch nicht bereit.
                </p>
            )}
        </div>
    )
}
