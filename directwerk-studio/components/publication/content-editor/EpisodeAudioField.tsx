'use client'

import {Card, CardContent} from '@directwerk/ui/components/card'
import {Input} from '@directwerk/ui/components/input'
import SectionHeader from '@directwerk/ui/components/section-header'

import MediaLibraryPicker from '@/components/media/MediaLibraryPicker'
import UploadProgress from '@/components/media/UploadProgress'
import {useDictionary} from '@/components/i18n/LocaleProvider'
import {mediaLimitLabel} from '@/lib/media/limits'

/**
 * Episode-only audio attach UI.
 * Intentionally isolated so later layers (#731 attach/save/redirect) can patch
 * this field without touching the shared editor shell.
 */
export default function EpisodeAudioField({
    hasAudio,
    audioAssetId,
    audioPreviewUrl,
    audioPreviewError,
    audioReady,
    audioStatusKnown,
    controlsDisabled,
    isUploading,
    uploadProgress,
    showLibraryPicker,
    onAuthRequired,
    onUpload,
    onSelectFromLibrary,
}: {
    hasAudio: boolean
    audioAssetId: number | null
    audioPreviewUrl: string | null
    audioPreviewError: string | null
    audioReady: boolean
    audioStatusKnown: boolean
    controlsDisabled: boolean
    isUploading: boolean
    uploadProgress: {file: File; progress: number} | null
    showLibraryPicker: boolean
    onAuthRequired: () => void
    onUpload: (file: File | null) => Promise<void>
    onSelectFromLibrary: (assetId: number) => Promise<void>
}): React.JSX.Element {
    const dict = useDictionary()

    return (
        <Card>
            <CardContent className="flex flex-col gap-3 pt-(--card-spacing)">
                <SectionHeader
                    as="h3"
                    description={dict.podcast.pflichtFeedHochladenMediathekWaehlen}
                    title="Audio"
                />
                {hasAudio ? (
                    <>
                        <p className="text-xs text-muted-foreground" role="status">
                            {audioStatusKnown
                                ? audioReady
                                    ? 'Audio bereit.'
                                    : 'Audio wird noch verarbeitet…'
                                : 'Audio-Status wird geladen…'}
                        </p>
                        {audioPreviewUrl !== null ? (
                            <audio
                                className="w-full max-w-full"
                                controls
                                preload="metadata"
                                src={audioPreviewUrl}
                            >
                                Audio-Wiedergabe wird nicht unterstützt.
                            </audio>
                        ) : audioPreviewError !== null ? (
                            <p className="text-xs text-muted-foreground" role="alert">
                                {audioPreviewError}
                            </p>
                        ) : (
                            <p className="text-xs text-muted-foreground">
                                Vorschau wird geladen…
                            </p>
                        )}
                    </>
                ) : (
                    <p className="text-xs text-muted-foreground">
                        Vor dem Veröffentlichen muss Audio hochgeladen werden.
                    </p>
                )}
                <label className="grid gap-2 text-sm font-medium">
                    <span>{hasAudio ? 'Audio ersetzen' : 'Audio-Datei'}</span>
                    <Input
                        type="file"
                        accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/ogg,audio/webm,.mp3,.m4a,.wav,.ogg,.webm"
                        disabled={controlsDisabled}
                        onChange={(event) => {
                            const file = event.target.files?.[0] ?? null
                            void onUpload(file)
                            event.target.value = ''
                        }}
                    />
                    <span className="text-xs font-normal text-muted-foreground">
                        Max. {mediaLimitLabel('AUDIO')}.
                    </span>
                </label>
                {showLibraryPicker ? (
                    <MediaLibraryPicker
                        assetType="AUDIO"
                        disabled={controlsDisabled}
                        label={
                            hasAudio
                                ? dict.podcast.audioMediathekErsetzen
                                : dict.podcast.audioMediathek
                        }
                        onAuthRequired={onAuthRequired}
                        onSelect={(asset) => {
                            void onSelectFromLibrary(asset.id)
                        }}
                        selectedId={audioAssetId}
                    />
                ) : null}
                {isUploading && uploadProgress === null ? (
                    <p className="text-xs text-muted-foreground">Upload läuft…</p>
                ) : null}
                {uploadProgress !== null ? (
                    <UploadProgress
                        file={uploadProgress.file}
                        progress={uploadProgress.progress}
                    />
                ) : null}
            </CardContent>
        </Card>
    )
}
