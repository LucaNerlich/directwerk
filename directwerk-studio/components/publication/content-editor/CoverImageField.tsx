'use client'

import {Button} from '@directwerk/ui/components/button'
import {Card, CardContent} from '@directwerk/ui/components/card'
import {Input} from '@directwerk/ui/components/input'
import SectionHeader from '@directwerk/ui/components/section-header'

import MediaLibraryPicker from '@/components/media/MediaLibraryPicker'
import UploadProgress from '@/components/media/UploadProgress'
import {mediaLimitLabel} from '@/lib/media/limits'

/**
 * Shared cover/hero image card for article and episode editors.
 * Library picker visibility stays content-type-specific (articles always;
 * episodes when DIGITAL_CONTENT is enabled).
 */
export default function CoverImageField({
    title,
    description,
    previewUrl,
    previewAlt,
    assetId,
    disabled,
    showLibraryPicker,
    libraryLabel,
    uploadLabel,
    replaceLabel,
    clearLabel = 'Titelbild entfernen',
    onAuthRequired,
    onUpload,
    onSelectFromLibrary,
    onClear,
    uploadProgress,
}: {
    title: string
    description: string
    previewUrl: string | null
    previewAlt: string
    assetId: number | null
    disabled: boolean
    showLibraryPicker: boolean
    libraryLabel: string
    uploadLabel: string
    replaceLabel: string
    clearLabel?: string
    onAuthRequired: () => void
    onUpload: (file: File | null) => Promise<void>
    onSelectFromLibrary: (assetId: number) => void
    onClear: () => void
    uploadProgress: {file: File; progress: number} | null
}): React.JSX.Element {
    return (
        <Card>
            <CardContent className="flex flex-col gap-3 pt-(--card-spacing)">
                <SectionHeader as="h3" description={description} title={title} />
                {previewUrl !== null ? (
                    <img
                        alt={previewAlt}
                        className="aspect-video w-full rounded-lg object-cover"
                        src={previewUrl}
                    />
                ) : null}
                <label className="grid gap-2 text-sm font-medium">
                    <span>{assetId === null ? uploadLabel : replaceLabel}</span>
                    <Input
                        accept="image/png,image/jpeg,image/webp"
                        disabled={disabled}
                        onChange={(event) => {
                            const file = event.target.files?.[0] ?? null
                            void onUpload(file)
                            event.target.value = ''
                        }}
                        type="file"
                    />
                    <span className="text-xs font-normal text-muted-foreground">
                        Max. {mediaLimitLabel('IMAGE')}.
                    </span>
                </label>
                {uploadProgress !== null ? (
                    <UploadProgress
                        file={uploadProgress.file}
                        progress={uploadProgress.progress}
                    />
                ) : null}
                {showLibraryPicker ? (
                    <MediaLibraryPicker
                        assetType="IMAGE"
                        requirePublic
                        disabled={disabled}
                        label={libraryLabel}
                        onAuthRequired={onAuthRequired}
                        onSelect={(asset) => {
                            onSelectFromLibrary(asset.id)
                        }}
                        selectedId={assetId}
                    />
                ) : null}
                {assetId !== null ? (
                    <Button
                        disabled={disabled}
                        onClick={onClear}
                        size="sm"
                        type="button"
                        variant="outline"
                    >
                        {clearLabel}
                    </Button>
                ) : null}
            </CardContent>
        </Card>
    )
}
