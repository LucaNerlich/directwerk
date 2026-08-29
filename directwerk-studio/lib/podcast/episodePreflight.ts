import type {SeriesStatus} from '@directwerk/api/types'

export interface EpisodePublishChecklistInput {
    seriesStatus: SeriesStatus | null
    hasAudioAsset: boolean
    audioReady: boolean
    audioStatusKnown: boolean
    showNotes: string
    formatRequired: boolean
    formatSelected: boolean
}


export function episodePublishBlockReason(
    input: EpisodePublishChecklistInput,
): string | null {
    if (input.seriesStatus !== 'PUBLISHED') {
        return 'Die Sendung muss zuerst veröffentlicht werden.'
    }
    if (!input.hasAudioAsset) {
        return 'Vor dem Veröffentlichen muss Audio hochgeladen werden.'
    }
    if (!input.audioStatusKnown) {
        return 'Audio-Status wird geprüft…'
    }
    if (!input.audioReady) {
        return 'Audio muss den Status READY haben.'
    }
    if (input.showNotes.trim().length === 0) {
        return 'Shownotes fehlen.'
    }
    if (input.formatRequired && !input.formatSelected) {
        return 'Mindestens ein Format ist erforderlich.'
    }
    return null
}
