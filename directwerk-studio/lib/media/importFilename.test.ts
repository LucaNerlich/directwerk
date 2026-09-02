import {describe, expect, it} from 'vitest'

import {filenameFromImportUrl} from '@/lib/media/importFilename'

describe('filenameFromImportUrl', () => {
    it('uses the last path segment from an absolute URL', () => {
        expect(filenameFromImportUrl('https://cdn.example/pod/show-cover.png?size=300', 'cover.jpg')).toBe(
            'show-cover.png',
        )
    })

    it('falls back when the URL path is empty', () => {
        expect(filenameFromImportUrl('https://cdn.example/', 'episode.mp3')).toBe('episode.mp3')
    })

    it('falls back when the path segment has no extension', () => {
        expect(filenameFromImportUrl('https://cdn.example/download?ep=1', 'episode.mp3')).toBe(
            'episode.mp3',
        )
        expect(filenameFromImportUrl('https://cdn.example/episode.mp3?x=1', 'episode.mp3')).toBe(
            'episode.mp3',
        )
        expect(filenameFromImportUrl('https://cdn.example/downloads/', 'episode.mp3')).toBe(
            'episode.mp3',
        )
        expect(filenameFromImportUrl('...', 'episode.mp3')).toBe('episode.mp3')
    })

    it('keeps segments with uppercase extensions', () => {
        expect(filenameFromImportUrl('https://cdn.example/Episode.MP3', 'episode.mp3')).toBe(
            'Episode.MP3',
        )
    })
})
