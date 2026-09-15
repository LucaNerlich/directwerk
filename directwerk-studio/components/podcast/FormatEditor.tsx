'use client'

import {HTML_SLUG_PATTERN} from '@directwerk/api/constants'
import {Button} from '@directwerk/ui/components/button'
import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {suggestSlug} from '@/lib/api/studioHelpers'
import {Textarea} from '@directwerk/ui/components/textarea'
import {Input} from '@directwerk/ui/components/input'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'
import SectionHeader from '@directwerk/ui/components/section-header'

import LevelSelect from '@/components/studio/LevelSelect'

import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useCallback, useEffect, useState} from 'react'

import MediaLibraryPicker from '@/components/media/MediaLibraryPicker'
import UploadProgress from '@/components/media/UploadProgress'
import {getMediaPreviewUrl} from '@/lib/api/mediaApi'
import {mediaLimitLabel} from '@/lib/media/limits'
import {useCoverImageUpload} from '@/lib/media/useCoverImageUpload'

import {createFormat, deactivateFormat, listFormats, updateFormat} from '@/lib/api/catalogApi'
import type {
    CreateFormatInput,
    FormatSummary,
    UpdateFormatInput,
} from '@directwerk/api/types'
import {getClientTenantHost} from '@directwerk/api/tenant'
import {useResourceEditor} from '@/lib/hooks/useResourceEditor'

interface FormatEditorProps {
    formatId?: number
}

interface FormatFormValues {
    name: string
    slug: string
    description: string
    requiredLevelSortOrder: number | null
    sortOrder: string
    coverAssetId: number | null
}

const INITIAL_VALUES: FormatFormValues = {
    name: '',
    slug: '',
    description: '',
    requiredLevelSortOrder: null,
    sortOrder: '',
    coverAssetId: null,
}

function toFormatValues(format: FormatSummary): FormatFormValues {
    return {
        name: format.name,
        slug: format.slug,
        description: format.description ?? '',
        requiredLevelSortOrder: format.requiredLevelSortOrder,
        sortOrder: String(format.sortOrder),
        coverAssetId: format.coverAssetId,
    }
}

function parseOptionalSortOrder(value: string): number | undefined {
    const text = value.trim()
    if (text.length === 0) {
        return undefined
    }
    const parsed = Number.parseInt(text, 10)
    return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined
}

interface FormatFields {
    name: string
    description?: string
    requiredLevelSortOrder?: number
    sortOrder?: number
    coverAssetId?: number
}

function formatFields(values: FormatFormValues): FormatFields {
    const description = values.description.trim()
    return {
        name: values.name.trim(),
        description: description.length > 0 ? description : undefined,
        requiredLevelSortOrder: values.requiredLevelSortOrder ?? undefined,
        sortOrder: parseOptionalSortOrder(values.sortOrder),
        coverAssetId: values.coverAssetId ?? undefined,
    }
}

/**
 * Provides a form for creating a podcast format or editing an existing one.
 *
 * @param formatId - The identifier of the format to edit, or `undefined` to create a new format
 */
export default function FormatEditor({formatId}: FormatEditorProps): React.JSX.Element {
    const router = useRouter()

    const {
        entity: format,
        values,
        setField,
        isNew,
        isLoading,
        loadError,
        reload,
        isSaving,
        isDeactivating,
        errorMessage,
        statusMessage,
        reportError,
        handleSubmit,
        handleDeactivate,
    } = useResourceEditor<
        FormatSummary,
        FormatFormValues,
        CreateFormatInput,
        UpdateFormatInput
    >({
        id: formatId,
        load: listFormats,
        create: createFormat,
        update: updateFormat,
        deactivate: deactivateFormat,
        initialValues: INITIAL_VALUES,
        toValues: toFormatValues,
        validate: (current) =>
            current.name.trim().length === 0 ? 'Name ist erforderlich.' : null,
        buildCreate: (current) => ({
            slug: current.slug.trim() || suggestSlug(current.name) || 'format',
            ...formatFields(current),
        }),
        buildUpdate: (current) => formatFields(current),
        redirectPath: (created) => `/podcast/formats/${created.id}`,
        createSuccessMessage: (created) => `Format "${created.name}" angelegt.`,
        updateSuccessMessage: 'Format gespeichert.',
        messages: {
            notFound: 'Format wurde nicht gefunden.',
            loadFailed: 'Format konnte nicht geladen werden.',
            saveFailed: 'Aktion fehlgeschlagen.',
            deactivateFailed: 'Deaktivierung fehlgeschlagen.',
        },
    })

    const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null)
    const [coverUploadError, setCoverUploadError] = useState<string | null>(null)

    useEffect(() => {
        let active = true

        if (values.coverAssetId === null) {
            setCoverPreviewUrl(null)
            return
        }

        getMediaPreviewUrl(getClientTenantHost(), values.coverAssetId)
            .then((url) => {
                if (active) {
                    setCoverPreviewUrl(url)
                }
            })
            .catch(() => {
                if (active) {
                    setCoverPreviewUrl(null)
                }
            })

        return () => {
            active = false
        }
    }, [values.coverAssetId])

    const handleCoverUploaded = useCallback(
        (assetId: number) => {
            setField('coverAssetId', assetId)
        },
        [setField],
    )

    const handleCoverError = useCallback(
        (error: unknown) => {
            reportError(error, 'Cover-Upload fehlgeschlagen.')
        },
        [reportError],
    )

    const coverUpload = useCoverImageUpload({
        onUploaded: handleCoverUploaded,
        onError: handleCoverError,
    })

    const handleCoverUpload = useCallback(
        (file: File | null): Promise<void> => {
            setCoverUploadError(null)
            return coverUpload.upload(file)
        },
        [coverUpload],
    )

    if (isLoading) {
        return <p>Laden…</p>
    }

    if (loadError) {
        return (
            <PageStack className="gap-6">
                <Alert variant="destructive">
                    <AlertDescription>{loadError}</AlertDescription>
                    <Button
                        className="mt-3"
                        onClick={reload}
                        type="button"
                        variant="outline"
                    >
                        Erneut versuchen
                    </Button>
                </Alert>
                <p className="text-sm text-muted-foreground">
                    <Link href="/podcast/formats">Zurück zur Liste</Link>
                </p>
            </PageStack>
        )
    }

    return (
        <PageStack className="gap-6">
            <PageHeader
                actions={
                    <Button nativeButton={false} render={<Link href="/podcast/formats" />} variant="outline">
                        Zurück zur Liste
                    </Button>
                }
                description="Formate erscheinen beim Erstellen einer Folge als Auswahl. Das Titelbild wird als RSS-Fallback für Folgen dieses Formats genutzt."
                eyebrow="Podcast · Einrichtung"
                title={isNew ? 'Neues Format' : 'Format bearbeiten'}
            />

            {errorMessage ? (
                <Alert variant="destructive">
                    <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
            ) : null}
            {statusMessage ? (
                <p className="text-sm text-muted-foreground" role="status">{statusMessage}</p>
            ) : null}

            <form
                className="grid w-full max-w-2xl gap-6"
                onSubmit={(event) => void handleSubmit(event)}
            >
                <section aria-labelledby="format-basics-heading" className="grid gap-4">
                    <SectionHeader
                        description="Name und URL-Kennung. Der Slug kann nach dem Anlegen nicht mehr geändert werden."
                        id="format-basics-heading"
                        title="Grundlagen"
                    />
                    <div className="grid gap-2">
                        <label className="text-sm font-medium" htmlFor="format-name">Name</label>
                        <Input
                            id="format-name"
                            maxLength={255}
                            onChange={(event) => setField('name', event.target.value)}
                            required
                            type="text"
                            value={values.name}
                        />
                    </div>
                    <div className="grid gap-2">
                        <label className="text-sm font-medium" htmlFor="format-slug">Slug</label>
                        <Input
                            disabled={!isNew}
                            id="format-slug"
                            maxLength={64}
                            onChange={(event) => setField('slug', event.target.value)}
                            pattern={HTML_SLUG_PATTERN}
                            required={isNew}
                            type="text"
                            value={values.slug}
                        />
                        <p className="text-xs text-muted-foreground">
                            Kleinbuchstaben, Zahlen und Bindestriche.
                            {isNew ? '' : ' Nach dem Anlegen gesperrt.'}
                        </p>
                    </div>
                    <div className="grid gap-2">
                        <label className="text-sm font-medium" htmlFor="format-description">Beschreibung</label>
                        <Textarea
                            id="format-description"
                            onChange={(event) => setField('description', event.target.value)}
                            rows={4}
                            value={values.description}
                        />
                        <p className="text-xs text-muted-foreground">
                            Optional. Hilft dir, Formate auseinanderzuhalten.
                        </p>
                    </div>
                </section>
                <section aria-labelledby="format-cover-heading" className="grid gap-2">
                    <SectionHeader
                        description="Fallback, wenn eine Folge kein eigenes Cover hat."
                        id="format-cover-heading"
                        title="Titelbild (RSS-Fallback)"
                    />
                    {coverPreviewUrl !== null ? (
                        <img alt="" className="block max-w-48 rounded-md" src={coverPreviewUrl} />
                    ) : null}
                    <Input
                        accept="image/png,image/jpeg,image/webp"
                        aria-label="Titelbild hochladen"
                        disabled={isSaving || coverUpload.isUploading}
                        onChange={(event) => {
                            const file = event.target.files?.[0] ?? null
                            void handleCoverUpload(file)
                            event.target.value = ''
                        }}
                        type="file"
                    />
                    <span className="text-xs text-muted-foreground">
                        Max. {mediaLimitLabel('IMAGE')}.
                    </span>
                    <MediaLibraryPicker
                        assetType="IMAGE"
                        disabled={isSaving || coverUpload.isUploading}
                        label="Titelbild aus Mediathek"
                        onAuthRequired={() => router.replace('/login')}
                        onSelect={(asset) => setField('coverAssetId', asset.id)}
                        selectedId={values.coverAssetId}
                    />
                    {coverUpload.uploadProgress !== null ? (
                        <UploadProgress file={coverUpload.uploadProgress.file} progress={coverUpload.uploadProgress.progress} />
                    ) : null}
                    {coverUploadError !== null ? (
                        <p className="text-sm text-destructive" role="alert">
                            {coverUploadError}
                        </p>
                    ) : null}
                </section>
                <section aria-labelledby="format-access-heading" className="grid gap-4">
                    <SectionHeader
                        description="Wer darf Folgen dieses Formats hören? Kann pro Folge überschrieben werden."
                        id="format-access-heading"
                        title="Zugriff und Reihenfolge"
                    />
                    <div className="grid gap-2">
                        <label className="text-sm font-medium" htmlFor="format-required-level">Mindest-Stufe</label>
                        <LevelSelect
                            id="format-required-level"
                            onChange={(value) => setField('requiredLevelSortOrder', value)}
                            value={values.requiredLevelSortOrder}
                        />
                        <span className="mt-1 block text-sm text-muted-foreground">
                            Niedrigste Stufe, die auf Folgen dieses Formats zugreifen darf.
                            Zugriff hat, wessen höchste Stufe ≥ Mindest-Stufe ist. „Öffentlich“ = jede aktive Stufe.
                        </span>
                    </div>
                    <div className="grid gap-2">
                        <label className="text-sm font-medium" htmlFor="format-sort-order">Anzeigereihenfolge in der Formatauswahl</label>
                        <Input
                            id="format-sort-order"
                            min={0}
                            onChange={(event) => setField('sortOrder', event.target.value)}
                            type="number"
                            value={values.sortOrder}
                        />
                        <span className="mt-1 block text-sm text-muted-foreground">
                            Legt fest, an welcher Position dieses Format in der Format-Auswahl beim
                            Erstellen einer Folge erscheint — hat nichts mit Zugriff zu tun.
                        </span>
                    </div>
                </section>
                <div className="flex flex-wrap gap-2">
                    <Button disabled={isSaving || coverUpload.isUploading} type="submit">
                        {isSaving ? 'Speichert…' : 'Speichern'}
                    </Button>
                    {!isNew && format?.active ? (
                        <Button
                            disabled={isDeactivating}
                            onClick={() => void handleDeactivate()}
                            type="button"
                            variant="outline"
                        >
                            {isDeactivating ? 'Deaktiviert…' : 'Deaktivieren'}
                        </Button>
                    ) : null}
                </div>
            </form>
        </PageStack>
    )
}
