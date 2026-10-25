import {describe, expect, it} from 'vitest'

import {extensionOfFilename, filenameFromReferenceTitle} from '@/lib/media/filenameFromReference'

describe('extensionOfFilename', () => {
    it('returns the extension including the dot', () => {
        expect(extensionOfFilename('download.mp3')).toBe('.mp3')
        expect(extensionOfFilename('Cover.PNG')).toBe('.PNG')
    })

    it('returns empty when there is no usable extension', () => {
        expect(extensionOfFilename('download')).toBe('')
        expect(extensionOfFilename('.hidden')).toBe('')
        expect(extensionOfFilename('ends-with-dot.')).toBe('')
        expect(extensionOfFilename(null)).toBe('')
        expect(extensionOfFilename(undefined)).toBe('')
    })
})

describe('filenameFromReferenceTitle', () => {
    it('uses the reference title and keeps the current extension', () => {
        expect(filenameFromReferenceTitle('download.mp3', 'Folge 1')).toBe('Folge 1.mp3')
        expect(filenameFromReferenceTitle('cover.png', '  Serienbild  ')).toBe('Serienbild.png')
    })

    it('falls back when the title is blank', () => {
        expect(filenameFromReferenceTitle('download.mp3', '   ')).toBe('asset.mp3')
    })

    it('works without an extension on the current name', () => {
        expect(filenameFromReferenceTitle('download', 'Folge 1')).toBe('Folge 1')
    })

    it('caps the stem so the full name stays under 180 characters', () => {
        const longTitle = 'a'.repeat(200)
        const result = filenameFromReferenceTitle('download.mp3', longTitle)
        expect(result.length).toBe(180)
        expect(result.endsWith('.mp3')).toBe(true)
    })
})
