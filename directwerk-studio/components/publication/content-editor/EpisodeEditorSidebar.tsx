'use client'

import {Card, CardContent} from '@directwerk/ui/components/card'
import {Input} from '@directwerk/ui/components/input'
import SectionHeader from '@directwerk/ui/components/section-header'

import CoverImageField from '@/components/publication/content-editor/CoverImageField'
import EpisodeAudioField from '@/components/publication/content-editor/EpisodeAudioField'
import FormatCategoryPicker from '@/components/publication/FormatCategoryPicker'
import {useDictionary} from '@/components/i18n/LocaleProvider'
import type {CategorySummary, FormatSummary} from '@directwerk/api/types'
import type {ResolvedMediaLimits} from '@/lib/media/limits'

/** Episode-only sidebar fields: audio, cover, episode number, enclosure, tags. */
export default function EpisodeEditorSidebar({
    title,
    hasAudio,
    audioAssetId,
    audioFilename,
    audioPreviewUrl,
    audioPreviewError,
    audioReady,
    audioStatusKnown,
    audioLimits,
    coverLimits,
    isUploading,
    uploadProgress,
    coverAssetId,
    coverPreviewUrl,
    coverUploadProgress,
    episodeNumber,
    storedEpisodeNumber,
    enclosureEnabled,
    showEnclosure,
    showClassification,
    availableFormats,
    availableCategories,
    selectedFormatIds,
    selectedCategoryIds,
    controlsDisabled,
    isEnclosureSaving,
    showLibraryPicker,
    onAuthRequired,
    onAudioUpload,
    onAudioFromLibrary,
    onCoverUpload,
    onCoverSelect,
    onCoverClear,
    onEpisodeNumberChange,
    onEnclosureChange,
    onFormatChange,
    onCategoryChange,
}: {
    title: string
    hasAudio: boolean
    audioAssetId: number | null
    audioFilename: string | null
    audioPreviewUrl: string | null
    audioPreviewError: string | null
    audioReady: boolean
    audioStatusKnown: boolean
    audioLimits: ResolvedMediaLimits
    coverLimits: ResolvedMediaLimits
    isUploading: boolean
    uploadProgress: {file: File; progress: number} | null
    coverAssetId: number | null
    coverPreviewUrl: string | null
    coverUploadProgress: {file: File; progress: number} | null
    episodeNumber: string
    storedEpisodeNumber: number | null
    enclosureEnabled: boolean
    showEnclosure: boolean
    showClassification: boolean
    availableFormats: FormatSummary[]
    availableCategories: CategorySummary[]
    selectedFormatIds: Set<number>
    selectedCategoryIds: Set<number>
    controlsDisabled: boolean
    isEnclosureSaving: boolean
    showLibraryPicker: boolean
    onAuthRequired: () => void
    onAudioUpload: (file: File | null) => Promise<void>
    onAudioFromLibrary: (asset: {
        id: number
        originalFilename?: string | null
    }) => Promise<void>
    onCoverUpload: (file: File | null) => Promise<void>
    onCoverSelect: (assetId: number) => void
    onCoverClear: () => void
    onEpisodeNumberChange: (value: string) => void
    onEnclosureChange: (enabled: boolean) => void
    onFormatChange: (ids: Set<number>) => void
    onCategoryChange: (ids: Set<number>) => void
}): React.JSX.Element {
    const dict = useDictionary()

    return (
        <>
            <EpisodeAudioField
                hasAudio={hasAudio}
                audioAssetId={audioAssetId}
                audioFilename={audioFilename}
                audioPreviewUrl={audioPreviewUrl}
                audioPreviewError={audioPreviewError}
                audioReady={audioReady}
                audioStatusKnown={audioStatusKnown}
                limits={audioLimits}
                controlsDisabled={controlsDisabled}
                isUploading={isUploading}
                uploadProgress={uploadProgress}
                showLibraryPicker={showLibraryPicker}
                onAuthRequired={onAuthRequired}
                onUpload={onAudioUpload}
                onSelectFromLibrary={onAudioFromLibrary}
            />
            <CoverImageField
                title="Titelbild (RSS)"
                description={dict.podcast.feedFolgenCoverGenutztOhneEigenes}
                previewUrl={coverPreviewUrl}
                previewAlt={
                    title.trim().length > 0 ? `Cover: ${title}` : 'Folgen-Cover'
                }
                assetId={coverAssetId}
                limits={coverLimits}
                disabled={controlsDisabled}
                showLibraryPicker={showLibraryPicker}
                libraryLabel={dict.podcast.titelbildMediathek}
                uploadLabel="Titelbild hochladen"
                replaceLabel="Titelbild ersetzen"
                onAuthRequired={onAuthRequired}
                onUpload={onCoverUpload}
                onSelectFromLibrary={onCoverSelect}
                onClear={onCoverClear}
                uploadProgress={coverUploadProgress}
            />
            <Card>
                <CardContent className="flex flex-col gap-4 pt-(--card-spacing)">
                    <SectionHeader
                        as="h3"
                        description={dict.podcast.nummerFeedAufnahmeKategorien}
                        title="Einordnung"
                    />
                    <label className="grid gap-2 text-sm font-medium">
                        <span>Folgennummer</span>
                        <Input
                            disabled={controlsDisabled}
                            min={1}
                            onChange={(event) => {
                                onEpisodeNumberChange(event.target.value)
                            }}
                            type="number"
                            value={episodeNumber}
                        />
                        <span className="text-xs font-normal text-muted-foreground">
                            Optional. Bestimmt die Reihenfolge im Feed.
                        </span>
                        {episodeNumber.trim() === '' && storedEpisodeNumber !== null ? (
                            <span className="text-xs font-normal text-muted-foreground">
                                Eine gespeicherte Nummer bleibt erhalten, wenn das Feld leer
                                gespeichert wird.
                            </span>
                        ) : null}
                    </label>
                    {showEnclosure ? (
                        <label className="grid gap-2 text-sm font-medium">
                            <span className="flex cursor-pointer items-center gap-2">
                                <Input
                                    checked={enclosureEnabled}
                                    className="size-4 shrink-0"
                                    disabled={controlsDisabled || isEnclosureSaving}
                                    onChange={(event) => {
                                        onEnclosureChange(event.target.checked)
                                    }}
                                    type="checkbox"
                                />
                                Audio im Feed (Enclosure)
                            </span>
                            <span className="text-xs font-normal text-muted-foreground">
                                Ausgeschaltet bleibt die Folge im Feed ohne Audiodatei.
                            </span>
                        </label>
                    ) : null}
                    {showClassification ? (
                        <FormatCategoryPicker
                            categories={availableCategories}
                            disabled={controlsDisabled}
                            formats={availableFormats}
                            onCategoryChange={onCategoryChange}
                            onFormatChange={onFormatChange}
                            selectedCategoryIds={selectedCategoryIds}
                            selectedFormatIds={selectedFormatIds}
                        />
                    ) : null}
                </CardContent>
            </Card>
        </>
    )
}
