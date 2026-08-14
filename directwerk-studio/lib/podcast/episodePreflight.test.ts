import {describe, expect, it} from 'vitest'

import {episodePublishBlockReason} from '@/lib/podcast/episodePreflight'

const ready = {
    seriesStatus: 'PUBLISHED' as const,
    hasAudioAsset: true,
    audioReady: true,
    audioStatusKnown: true,
    showNotes: 'Hallo',
    formatRequired: false,
    formatSelected: false,
}

describe('episodePublishBlockReason', () => {
    it('allows a complete episode', () => {
        expect(episodePublishBlockReason(ready)).toBeNull()
    })

    it('requires a published series', () => {
        expect(
            episodePublishBlockReason({...ready, seriesStatus: 'DRAFT'}),
        ).toBe('Die Sendung muss zuerst veröffentlicht werden.')
    })

    it('requires READY audio', () => {
        expect(
            episodePublishBlockReason({...ready, hasAudioAsset: false}),
        ).toBe('Vor dem Veröffentlichen muss Audio hochgeladen werden.')
        expect(
            episodePublishBlockReason({
                ...ready,
                audioStatusKnown: false,
            }),
        ).toBe('Audio-Status wird geprüft…')
        expect(
            episodePublishBlockReason({...ready, audioReady: false}),
        ).toBe('Audio muss den Status READY haben.')
    })

    it('requires show notes', () => {
        expect(episodePublishBlockReason({...ready, showNotes: '  '})).toBe(
            'Shownotes fehlen.',
        )
    })

    it('requires a format when formats exist', () => {
        expect(
            episodePublishBlockReason({
                ...ready,
                formatRequired: true,
                formatSelected: false,
            }),
        ).toBe('Mindestens ein Format ist erforderlich.')
        expect(
            episodePublishBlockReason({
                ...ready,
                formatRequired: true,
                formatSelected: true,
            }),
        ).toBeNull()
    })
})
