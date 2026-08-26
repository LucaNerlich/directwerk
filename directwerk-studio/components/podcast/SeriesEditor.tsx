'use client'

import SelectControl from '@/components/studio/SelectControl'
import LevelSelect from '@/components/studio/LevelSelect'

import {Button} from '@directwerk/ui/components/button'
import {Textarea} from '@directwerk/ui/components/textarea'
import {Input} from '@directwerk/ui/components/input'

import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useCallback, useEffect, useRef, useState, type FormEvent} from 'react'

import MediaLibraryPicker from '@/components/media/MediaLibraryPicker'
import UploadProgress from '@/components/media/UploadProgress'
import PublicationStatusBadge from '@/components/publication/PublicationStatusBadge'
import PublishedLinksPanel from '@/components/publication/PublishedLinksPanel'
import {
    createSeries,
    getMediaPreviewUrl,
    getSeries,
    suggestSlug,
    updateSeries,
} from '@/lib/api/tenantApi'
import type {SeriesStatus} from '@directwerk/api/types'
import {mediaLimitLabel} from '@/lib/media/limits'
import {uploadMediaFile} from '@/lib/media/upload'
import {getClientTenantHost} from '@/lib/tenant/getClientTenantHost'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'

interface SeriesEditorProps {
    seriesId?: number
}

/**
 * Renders a form for creating or editing a podcast series, including metadata and cover image management.
 *
 * @param seriesId - The identifier of the series to edit; omit to create a new series
 * @returns The series editor interface
 */
export default function SeriesEditor({seriesId}: SeriesEditorProps): React.JSX.Element {
    const router = useRouter()
    const authRedirect = useAuthRequired()
    const isNew = seriesId === undefined
    const [title, setTitle] = useState('')
    const [slug, setSlug] = useState('')
    const [description, setDescription] = useState('')
    const [language, setLanguage] = useState('de')
    const [itunesCategory, setItunesCategory] = useState('')
    const [status, setStatus] = useState<SeriesStatus>('DRAFT')
    const [coverAssetId, setCoverAssetId] = useState<number | null>(null)
    const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null)
    const [isUploadingCover, setIsUploadingCover] = useState(false)
    const [uploadProgress, setUploadProgress] = useState<{file: File; progress: number} | null>(
        null,
    )
    const mountedRef = useRef(true)
    const [defaultRequiredLevelSortOrder, setDefaultRequiredLevelSortOrder] = useState<number | null>(null)
    const [rssUrl, setRssUrl] = useState<string | null>(null)
    const [publishOnCreate, setPublishOnCreate] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(!isNew)
    const [isSaving, setIsSaving] = useState(false)
    const [loadError, setLoadError] = useState(false)

    useEffect(() => {
        mountedRef.current = true
        if (seriesId === undefined) {
            setIsLoading(false)
            return
        }

        const resolvedSeriesId = seriesId
        let active = true

        async function load(): Promise<void> {
            try {
                const loaded = await getSeries(getClientTenantHost(), resolvedSeriesId)
                if (!active) {
                    return
                }
                setTitle(loaded.title)
                setSlug(loaded.slug)
                setDescription(loaded.description ?? '')
                setLanguage(loaded.language ?? 'de')
                setItunesCategory(loaded.itunesCategory ?? '')
                setStatus(loaded.status)
                setCoverAssetId(loaded.coverAssetId)
                setDefaultRequiredLevelSortOrder(loaded.defaultRequiredLevelSortOrder)
                setRssUrl(loaded.rssUrl)
            } catch (error) {
                if (!active) {
                    return
                }
                if (authRedirect(error)) return
                setLoadError(true)
                setErrorMessage(
                    error instanceof Error
                        ? error.message
                        : 'Sendung konnte nicht geladen werden.',
                )
            } finally {
                if (active) {
                    setIsLoading(false)
                }
            }
        }

        load()

        return () => {
            active = false
            mountedRef.current = false
        }
    }, [router, seriesId])

    useEffect(() => {
        let active = true

        if (coverAssetId === null) {
            setCoverPreviewUrl(null)
            return
        }

        getMediaPreviewUrl(getClientTenantHost(), coverAssetId)
            .then((url) => {
                if (active) {
                    setCoverPreviewUrl(url)
                }
            })
            .catch((error: unknown) => {
                if (!active) {
                    return
                }
                if (authRedirect(error)) return
                setCoverPreviewUrl(null)
            })

        return () => {
            active = false
        }
    }, [coverAssetId, router])

    const handleAuthError = useCallback(
        (error: unknown) => {
            if (authRedirect(error)) return
            setErrorMessage(
                error instanceof Error ? error.message : 'Aktion fehlgeschlagen.',
            )
        },
        [router],
    )

    const handleAuthRequired = useCallback(() => {
        router.replace('/login')
    }, [router])

    async function handleCoverUpload(file: File | null): Promise<void> {
        if (file === null) {
            return
        }
        setIsUploadingCover(true)
        setErrorMessage(null)
        setUploadProgress({file, progress: 0})
        try {
            const asset = await uploadMediaFile(getClientTenantHost(), file, {
                assetType: 'IMAGE',
                visibility: 'PUBLIC',
                onProgress: (percent) => {
                    if (mountedRef.current) {
                        setUploadProgress({file, progress: percent})
                    }
                },
            })
            setCoverAssetId(asset.id)
        } catch (error) {
            authRedirect(error)
        } finally {
            if (mountedRef.current) {
                setIsUploadingCover(false)
                setUploadProgress(null)
            }
        }
    }

    function seriesUpdatePayload(nextStatus: SeriesStatus) {
        const resolvedSlug = slug.trim() || suggestSlug(title) || 'sendung'
        return {
            title: title.trim() || 'Ohne Titel',
            slug: resolvedSlug,
            description: description.trim() || undefined,
            language: language.trim() || 'de',
            itunesCategory: itunesCategory.trim() || undefined,
            coverAssetId: coverAssetId ?? undefined,
            defaultRequiredLevelSortOrder: defaultRequiredLevelSortOrder ?? undefined,
            status: nextStatus,
        }
    }

    function applySeries(updated: {
        title: string
        slug: string
        description: string | null
        language: string | null
        itunesCategory: string | null
        status: SeriesStatus
        coverAssetId: number | null
        defaultRequiredLevelSortOrder: number | null
        rssUrl: string | null
    }): void {
        setTitle(updated.title)
        setSlug(updated.slug)
        setDescription(updated.description ?? '')
        setLanguage(updated.language ?? 'de')
        setItunesCategory(updated.itunesCategory ?? '')
        setStatus(updated.status)
        setCoverAssetId(updated.coverAssetId)
        setDefaultRequiredLevelSortOrder(updated.defaultRequiredLevelSortOrder)
        setRssUrl(updated.rssUrl)
    }

    async function handlePublishSeries(): Promise<void> {
        if (isNew || seriesId === undefined) {
            return
        }
        setIsSaving(true)
        setErrorMessage(null)
        try {
            const updated = await updateSeries(
                getClientTenantHost(),
                seriesId,
                seriesUpdatePayload('PUBLISHED'),
            )
            applySeries(updated)
        } catch (error) {
            authRedirect(error)
        } finally {
            setIsSaving(false)
        }
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault()
        setIsSaving(true)
        setErrorMessage(null)

        const resolvedSlug = slug.trim() || suggestSlug(title) || 'sendung'
        const host = getClientTenantHost()

        try {
            if (isNew) {
                const created = await createSeries(host, {
                    title: title.trim() || 'Ohne Titel',
                    slug: resolvedSlug,
                    description: description.trim() || undefined,
                    language: language.trim() || 'de',
                    itunesCategory: itunesCategory.trim() || undefined,
                    coverAssetId: coverAssetId ?? undefined,
                    defaultRequiredLevelSortOrder: defaultRequiredLevelSortOrder ?? undefined,
                })
                if (publishOnCreate) {
                    await updateSeries(host, created.id, {
                        ...seriesUpdatePayload('PUBLISHED'),
                        slug: created.slug,
                    })
                }
                router.replace(`/podcast/series/${created.id}`)
                return
            }

            const updated = await updateSeries(
                host,
                seriesId,
                seriesUpdatePayload(status),
            )
            applySeries(updated)
        } catch (error) {
            authRedirect(error)
        } finally {
            setIsSaving(false)
        }
    }

    if (isLoading) {
        return <p>Sendung wird geladen…</p>
    }

    if (loadError) {
        return (
            <p>
                {errorMessage ?? 'Sendung konnte nicht geladen werden.'}{' '}
                <Link href="/podcast/series">Zurück zur Übersicht</Link>
            </p>
        )
    }

    return (
        <div className="flex flex-col gap-6">
            <header className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Podcast</p>
                    <h1>{isNew ? 'Neue Sendung' : 'Sendung bearbeiten'}</h1>
                    {!isNew && <PublicationStatusBadge status={status} />}
                </div>
                <Link className="text-sm font-medium text-primary underline-offset-4 hover:underline" href="/podcast/series">
                    Zur Übersicht
                </Link>
            </header>

            {errorMessage !== null && (
                <p className="text-sm text-destructive" role="alert">
                    {errorMessage}
                </p>
            )}

            <form className="grid w-full max-w-xl gap-5" onSubmit={(event) => void handleSubmit(event)}>
                <label className="grid gap-2 text-sm font-medium">
                    <span>Titel</span>
                    <Input
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                        value={title}
                        onChange={(event) => {
                            const value = event.target.value
                            setTitle(value)
                            if (isNew && slug.trim().length === 0) {
                                setSlug(suggestSlug(value))
                            }
                        }}
                        required
                        maxLength={255}
                    />
                </label>
                <label className="grid gap-2 text-sm font-medium">
                    <span>Slug</span>
                    <Input
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                        value={slug}
                        onChange={(event) => setSlug(event.target.value)}
                        required
                        pattern="^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,62}[a-zA-Z0-9])?$"
                        maxLength={63}
                    />
                </label>
                <label className="grid gap-2 text-sm font-medium">
                    <span>Beschreibung</span>
                    <Textarea
                        className="flex min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                        rows={6}
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                    />
                </label>
                <label className="grid gap-2 text-sm font-medium">
                    <span>Sprache</span>
                    <Input
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                        value={language}
                        onChange={(event) => setLanguage(event.target.value)}
                        maxLength={8}
                        required
                    />
                </label>
                <label className="grid gap-2 text-sm font-medium">
                    <span>iTunes-Kategorie</span>
                    <Input
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                        value={itunesCategory}
                        onChange={(event) => setItunesCategory(event.target.value)}
                        maxLength={128}
                    />
                </label>
                <div className="grid gap-2 text-sm font-medium">
                    <span>Titelbild</span>
                    {coverPreviewUrl !== null ? (
                        <img alt="" src={coverPreviewUrl} style={{maxWidth: '12rem', display: 'block'}} />
                    ) : null}
                    <Input
                        accept="image/png,image/jpeg,image/webp"
                        disabled={isUploadingCover}
                        onChange={(event) => {
                            const file = event.target.files?.[0] ?? null
                            void handleCoverUpload(file)
                            event.target.value = ''
                        }}
                        type="file"
                    />
                    <span className="text-xs font-normal text-muted-foreground">
                        Max. {mediaLimitLabel('IMAGE')}.
                    </span>
                    <MediaLibraryPicker
                        assetType="IMAGE"
                        disabled={isUploadingCover || isSaving}
                        label="Titelbild aus Mediathek"
                        onAuthRequired={handleAuthRequired}
                        onSelect={(asset) => {
                            setCoverAssetId(asset.id)
                        }}
                        selectedId={coverAssetId}
                    />
                    {uploadProgress !== null ? (
                        <UploadProgress
                            file={uploadProgress.file}
                            progress={uploadProgress.progress}
                        />
                    ) : null}
                </div>
                <label className="grid gap-2 text-sm font-medium">
                    <span>Mindest-Stufe für Folgen (Standard)</span>
                    <LevelSelect
                        onChange={(value) => setDefaultRequiredLevelSortOrder(value)}
                        value={defaultRequiredLevelSortOrder}
                    />
                    <span className="font-normal text-muted-foreground">
                        Standard-Mindest-Stufe für neue Folgen dieser Sendung. Zugriff hat,
                        wessen höchste Stufe ≥ Mindest-Stufe ist. „Öffentlich“ = jede aktive
                        Stufe.
                    </span>
                </label>
                {rssUrl !== null ? (
                    <PublishedLinksPanel
                        title="RSS-Feed"
                        links={[{label: 'Sendungs-Feed', url: rssUrl}]}
                        hint="Direkt nach dem Veröffentlichen kann der Feed noch 404 liefern, bis der Snapshot geschrieben ist."
                    />
                ) : status === 'DRAFT' ? (
                    <p className="text-sm text-muted-foreground">
                        Der öffentliche Feed erscheint, sobald die Sendung
                        veröffentlicht ist.
                    </p>
                ) : null}
                {isNew ? (
                    <label className="grid gap-2 text-sm font-medium" style={{display: 'block'}}>
                        <Input
                            checked={publishOnCreate}
                            onChange={(event) => setPublishOnCreate(event.target.checked)}
                            className="size-4 shrink-0" type="checkbox"
                        />{' '}
                        Sendung sofort veröffentlichen
                    </label>
                ) : (
                    <>
                        {status === 'DRAFT' ? (
                            <Button
                                className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
                                disabled={isSaving}
                                onClick={() => void handlePublishSeries()}
                                type="button"
                            >
                                {isSaving ? 'Speichert…' : 'Sendung veröffentlichen'}
                            </Button>
                        ) : null}
                        <label className="grid gap-2 text-sm font-medium">
                            <span>Status</span>
                            <SelectControl
                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                                value={status}
                                onChange={(event) =>
                                    setStatus(event.target.value as SeriesStatus)
                                }
                            >
                                <option value="DRAFT">Entwurf</option>
                                <option value="PUBLISHED">Veröffentlicht</option>
                            </SelectControl>
                        </label>
                    </>
                )}
                <Button className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50" type="submit" disabled={isSaving}>
                    {isSaving ? 'Speichert…' : isNew ? 'Sendung anlegen' : 'Speichern'}
                </Button>
            </form>
        </div>
    )
}
