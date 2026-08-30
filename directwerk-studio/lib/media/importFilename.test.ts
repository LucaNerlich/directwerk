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
})
