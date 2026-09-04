'use client'

import {HTML_SLUG_PATTERN} from '@directwerk/api/constants'
import SelectControl from '@/components/studio/SelectControl'
import {suggestSlug} from '@/lib/api/studioHelpers'
import LevelSelect from '@/components/studio/LevelSelect'

import {Button} from '@directwerk/ui/components/button'
import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Textarea} from '@directwerk/ui/components/textarea'
import {Input} from '@directwerk/ui/components/input'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'
import SectionHeader from '@directwerk/ui/components/section-header'

import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useCallback, useEffect, useState, type FormEvent} from 'react'

import MediaLibraryPicker from '@/components/media/MediaLibraryPicker'
import UploadProgress from '@/components/media/UploadProgress'
import PublicationStatusBadge from '@/components/publication/PublicationStatusBadge'
import PublishedLinksPanel from '@/components/publication/PublishedLinksPanel'
import {getMediaPreviewUrl} from '@/lib/api/mediaApi'
import {createSeries, getSeries, updateSeries} from '@/lib/api/podcastApi'
import type {SeriesDetail, SeriesStatus} from '@directwerk/api/types'
import {mediaLimitLabel} from '@/lib/media/limits'
import {useCoverImageUpload} from '@/lib/media/useCoverImageUpload'
import {getClientTenantHost} from '@directwerk/api/tenant'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'

interface SeriesEditorProps {
    seriesId?: number
}

export default function SeriesEditor({seriesId}: SeriesEditorProps): React.JSX.Element {
    const router = useRouter()
    const authRedirect = useAuthRequired()
    const [createdId, setCreatedId] = useState<number | null>(null)
    const effectiveSeriesId = seriesId ?? createdId ?? undefined
    const isNew = effectiveSeriesId === undefined
    const [title, setTitle] = useState('')
    const [slug, setSlug] = useState('')
    const [description, setDescription] = useState('')
    const [language, setLanguage] = useState('de')
    const [itunesCategory, setItunesCategory] = useState('')
    const [itunesExplicit, setItunesExplicit] = useState(false)
    const [status, setStatus] = useState<SeriesStatus>('DRAFT')
    const [coverAssetId, setCoverAssetId] = useState<number | null>(null)
    const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null)
    const [defaultRequiredLevelSortOrder, setDefaultRequiredLevelSortOrder] = useState<number | null>(null)
    const [rssUrl, setRssUrl] = useState<string | null>(null)
    const [publishOnCreate, setPublishOnCreate] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(!isNew)
    const [isSaving, setIsSaving] = useState(false)
    const [loadError, setLoadError] = useState(false)
    const [reloadToken, setReloadToken] = useState(0)

    useEffect(() => {
        if (seriesId === undefined) {
            setIsLoading(false)
            return
        }
        setIsLoading(true)
        setLoadError(false)
        setErrorMessage(null)

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
                setItunesExplicit(loaded.itunesExplicit)
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
        }
    }, [reloadToken, router, seriesId])

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

    const coverUpload = useCoverImageUpload({
        onUploaded: setCoverAssetId,
        onError: (error) => {
            if (authRedirect(error)) return
            setErrorMessage(
                error instanceof Error ? error.message : 'Cover-Upload fehlgeschlagen.',
            )
        },
    })

    function handleCoverUpload(file: File | null): Promise<void> {
        setErrorMessage(null)
        return coverUpload.upload(file)
    }

    function seriesUpdatePayload(nextStatus: SeriesStatus) {
        const resolvedSlug = slug.trim() || suggestSlug(title) || 'sendung'
        return {
            title: title.trim() || 'Ohne Titel',
            slug: resolvedSlug,
            description: description.trim() || undefined,
            language: language.trim() || 'de',
            itunesCategory: itunesCategory.trim() || undefined,
            itunesExplicit,
            coverAssetId: coverAssetId ?? undefined,
            defaultRequiredLevelSortOrder: defaultRequiredLevelSortOrder ?? undefined,
            status: nextStatus,
        }
    }

    function applySeries(updated: SeriesDetail): void {
        setTitle(updated.title)
        setSlug(updated.slug)
        setDescription(updated.description ?? '')
        setLanguage(updated.language ?? 'de')
        setItunesCategory(updated.itunesCategory ?? '')
        setItunesExplicit(updated.itunesExplicit)
        setStatus(updated.status)
        setCoverAssetId(updated.coverAssetId)
        setDefaultRequiredLevelSortOrder(updated.defaultRequiredLevelSortOrder)
        setRssUrl(updated.rssUrl)
    }

    async function handlePublishSeries(): Promise<void> {
        if (effectiveSeriesId === undefined) {
            return
        }
        const targetId = effectiveSeriesId
        setIsSaving(true)
        setErrorMessage(null)
        try {
            const updated = await updateSeries(
                getClientTenantHost(),
                targetId,
                seriesUpdatePayload('PUBLISHED'),
            )
            applySeries(updated)
        } catch (error) {
            if (authRedirect(error)) return
            setErrorMessage(
                error instanceof Error ? error.message : 'Veröffentlichung fehlgeschlagen.',
            )
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
                    itunesExplicit,
                    coverAssetId: coverAssetId ?? undefined,
                    defaultRequiredLevelSortOrder: defaultRequiredLevelSortOrder ?? undefined,
                })
                // Remember the created series so a failed follow-up publish
                // retries as an update instead of creating a duplicate.
                setCreatedId(created.id)
                if (publishOnCreate) {
                    try {
                        await updateSeries(host, created.id, {
                            ...seriesUpdatePayload('PUBLISHED'),
                            slug: created.slug,
                        })
                    } catch (publishError) {
                        applySeries(created)
                        setErrorMessage(
                            publishError instanceof Error
                                ? publishError.message
                                : 'Veröffentlichung fehlgeschlagen.',
                        )
                        return
                    }
                }
                router.replace(`/podcast/series/${created.id}`)
                return
            }

            if (effectiveSeriesId === undefined) {
                return
            }
            const updated = await updateSeries(
                host,
                effectiveSeriesId,
                seriesUpdatePayload(status),
            )
            applySeries(updated)
        } catch (error) {
            if (authRedirect(error)) return
            setErrorMessage(
                error instanceof Error ? error.message : 'Aktion fehlgeschlagen.',
            )
        } finally {
            setIsSaving(false)
        }
    }

    if (isLoading) {
        return <p>Sendung wird geladen…</p>
    }

    if (loadError) {
        return (
            <PageStack className="gap-6">
                <Alert variant="destructive">
                    <AlertDescription>
                        {errorMessage ?? 'Sendung konnte nicht geladen werden.'}
                    </AlertDescription>
                    <Button
                        className="mt-3"
                        onClick={() => setReloadToken((value) => value + 1)}
                        type="button"
                        variant="outline"
                    >
                        Erneut versuchen
                    </Button>
                </Alert>
                <p className="text-sm text-muted-foreground">
                    <Link href="/podcast/series">Zurück zur Übersicht</Link>
                </p>
            </PageStack>
        )
    }

    return (
        <PageStack className="gap-6">
            <PageHeader
                actions={
                    <Button nativeButton={false} render={<Link href="/podcast/series" />} variant="outline">
                        Zur Übersicht
                    </Button>
                }
                description="Titel, Cover und Feed-Metadaten. Einmal einrichten — der laufende Flow nutzt Folgen."
                eyebrow="Podcast · Einrichtung"
                title={isNew ? 'Neue Sendung' : 'Sendung bearbeiten'}
            />
            {!isNew ? (
                <div>
                    <PublicationStatusBadge status={status} />
                </div>
            ) : null}

            {errorMessage !== null && (
                <Alert variant="destructive">
                    <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
            )}

            <form className="grid w-full max-w-2xl gap-6" onSubmit={(event) => void handleSubmit(event)}>
                <section aria-labelledby="series-basics-heading" className="grid gap-4">
                    <SectionHeader
                        description="So sehen Hörer deine Sendung in Apps und Verzeichnissen."
                        id="series-basics-heading"
                        title="Grundlagen"
                    />
                    <label className="grid gap-2 text-sm font-medium" htmlFor="series-title">
                        <span>Titel</span>
                    </label>
                    <Input
                        id="series-title"
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
                    <div className="grid gap-2">
                        <label className="grid gap-2 text-sm font-medium" htmlFor="series-slug">
                            <span>Slug</span>
                        </label>
                        <Input
                            id="series-slug"
                            value={slug}
                            onChange={(event) => setSlug(event.target.value)}
                            required
                            pattern={HTML_SLUG_PATTERN}
                            maxLength={63}
                        />
                        <p className="text-xs font-normal text-muted-foreground">
                            Kleinbuchstaben, Zahlen und Bindestriche. Wird in Feed-URL und Links verwendet.
                        </p>
                    </div>
                    <label className="grid gap-2 text-sm font-medium" htmlFor="series-description">
                        <span>Beschreibung</span>
                        <Textarea
                            id="series-description"
                            rows={6}
                            value={description}
                            onChange={(event) => setDescription(event.target.value)}
                        />
                        <span className="text-xs font-normal text-muted-foreground">
                            Kurzbeschreibung für Podcast-Apps und Verzeichnisse.
                        </span>
                    </label>
                    <label className="grid gap-2 text-sm font-medium" htmlFor="series-language">
                        <span>Sprache</span>
                        <Input
                            id="series-language"
                            value={language}
                            onChange={(event) => setLanguage(event.target.value)}
                            maxLength={8}
                            required
                        />
                        <span className="text-xs font-normal text-muted-foreground">
                            ISO-Code, z. B. „de“ oder „en“.
                        </span>
                    </label>
                </section>
                <section aria-labelledby="series-feed-heading" className="grid gap-4">
                    <SectionHeader
                        description="Apple & Co. lesen diese Angaben aus dem RSS-Feed."
                        id="series-feed-heading"
                        title="Feed-Details"
                    />
                    <label className="grid gap-2 text-sm font-medium" htmlFor="series-itunes-category">
                        <span>iTunes-Kategorie</span>
                        <Input
                            id="series-itunes-category"
                            value={itunesCategory}
                            onChange={(event) => setItunesCategory(event.target.value)}
                            maxLength={128}
                        />
                        <span className="font-normal text-muted-foreground">
                            Apple-Podcast-Kategorie des Feeds (z. B. Comedy, News).
                        </span>
                    </label>
                    <label className="grid gap-2 text-sm font-medium" htmlFor="series-explicit">
                        <span>Explicit-Inhalte</span>
                        <SelectControl
                            id="series-explicit"
                            value={itunesExplicit ? 'true' : 'false'}
                            onChange={(event) => setItunesExplicit(event.target.value === 'true')}
                        >
                            <option value="false">Nein (clean)</option>
                            <option value="true">Ja (explicit)</option>
                        </SelectControl>
                        <span className="font-normal text-muted-foreground">
                            Apple verlangt diese Angabe im Feed. Nur auf „Ja“ stellen, wenn die
                            Sendung explizite Inhalte enthält.
                        </span>
                    </label>
                </section>
                <section aria-labelledby="series-cover-heading" className="grid gap-2">
                    <SectionHeader
                        description="Quadratisch, mindestens 1400 × 1400 px empfohlen."
                        id="series-cover-heading"
                        title="Titelbild"
                    />
                    {coverPreviewUrl !== null ? (
                        <img
                            alt=""
                            className="block max-w-48 rounded-md"
                            src={coverPreviewUrl}
                        />
                    ) : null}
                    <Input
                        accept="image/png,image/jpeg,image/webp"
                        aria-label="Titelbild hochladen"
                        disabled={coverUpload.isUploading}
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
                        disabled={coverUpload.isUploading || isSaving}
                        label="Titelbild aus Mediathek"
                        onAuthRequired={handleAuthRequired}
                        onSelect={(asset) => {
                            setCoverAssetId(asset.id)
                        }}
                        selectedId={coverAssetId}
                    />
                    {coverUpload.uploadProgress !== null ? (
                        <UploadProgress
                            file={coverUpload.uploadProgress.file}
                            progress={coverUpload.uploadProgress.progress}
                        />
                    ) : null}
                </section>
                <section aria-labelledby="series-access-heading" className="grid gap-2">
                    <SectionHeader
                        description="Standard für neue Folgen dieser Sendung. Kann pro Folge überschrieben werden."
                        id="series-access-heading"
                        title="Zugriff"
                    />
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
                </section>
                <section aria-labelledby="series-publish-heading" className="grid gap-3">
                    <SectionHeader
                        description={isNew ? 'Anlegen und optional sofort veröffentlichen.' : 'Speichern, Status wechseln und Feed prüfen.'}
                        id="series-publish-heading"
                        title="Veröffentlichung"
                    />
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
                        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                            <Input
                                checked={publishOnCreate}
                                className="size-4 shrink-0"
                                onChange={(event) => setPublishOnCreate(event.target.checked)}
                                type="checkbox"
                            />
                            Sendung sofort veröffentlichen
                        </label>
                    ) : (
                        <>
                            {status === 'DRAFT' ? (
                                <div>
                                    <Button
                                        disabled={isSaving}
                                        onClick={() => void handlePublishSeries()}
                                        type="button"
                                    >
                                        {isSaving ? 'Speichert…' : 'Sendung veröffentlichen'}
                                    </Button>
                                </div>
                            ) : null}
                            <label className="grid gap-2 text-sm font-medium">
                                <span>Status</span>
                                <SelectControl
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
                    <div>
                        <Button type="submit" disabled={isSaving || coverUpload.isUploading}>
                            {isSaving ? 'Speichert…' : isNew ? 'Sendung anlegen' : 'Speichern'}
                        </Button>
                    </div>
                </section>
            </form>
        </PageStack>
    )
}
