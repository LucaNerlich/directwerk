import {describe, expect, it} from 'vitest'

import {filenameFromImportUrl, isGenericFilenameStem} from '@/lib/media/importFilename'

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
        expect(filenameFromImportUrl('https://cdn.example/Finale.MP3', 'episode.mp3')).toBe(
            'Finale.MP3',
        )
    })

    it('falls back for generic stems that identify nothing', () => {        expect(filenameFromImportUrl('https://cdn.example/download.mp3', 'episode.mp3')).toBe(
            'episode.mp3',
        )
        expect(filenameFromImportUrl('https://cdn.example/Download.MP3?x=1', 'episode.mp3')).toBe(
            'episode.mp3',
        )
        expect(filenameFromImportUrl('https://cdn.example/Episode.MP3', 'episode.mp3')).toBe(
            'episode.mp3',
        )
        expect(isGenericFilenameStem('download')).toBe(true)
        expect(isGenericFilenameStem(' Download ')).toBe(true)
        expect(isGenericFilenameStem('folge-1')).toBe(false)
    })

    it('prefers the given stem and keeps the real extension', () => {
        expect(
            filenameFromImportUrl('https://cdn.example/ep1.mp3', 'episode.mp3', 'folge-1'),
        ).toBe('folge-1.mp3')
        expect(
            filenameFromImportUrl('https://cdn.example/download', 'episode.mp3', 'folge-1'),
        ).toBe('folge-1.mp3')
        expect(
            filenameFromImportUrl('https://cdn.example/cover.png', 'cover.jpg', 'folge-1'),
        ).toBe('folge-1.png')
        expect(filenameFromImportUrl('', 'episode.mp3', 'folge-1')).toBe('folge-1.mp3')
        expect(filenameFromImportUrl('https://cdn.example/ep1.mp3', 'episode.mp3', '  ')).toBe(
            'ep1.mp3',
        )
    })
})
