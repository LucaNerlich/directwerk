import {describe, expect, it} from 'vitest'

import {
    extensionOfFilename,
    filenameFromReferenceTitle,
    sanitizeFilenameMirror,
} from '@/lib/media/filenameFromReference'

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

describe('sanitizeFilenameMirror', () => {
    it('mirrors backend unsafe-character replacement', () => {
        expect(sanitizeFilenameMirror('Folge 42.mp3')).toBe('Folge_42.mp3')
        expect(sanitizeFilenameMirror('evil name!!.mp3')).toBe('evil_name_.mp3')
        expect(sanitizeFilenameMirror('../../evil name!!.mp3')).toBe('evil_name_.mp3')
    })
})

describe('filenameFromReferenceTitle', () => {
    it('slugifies the reference title and keeps the current extension', () => {
        expect(filenameFromReferenceTitle('download.mp3', 'Folge 1')).toBe('folge-1.mp3')
        expect(filenameFromReferenceTitle('cover.png', '  Serienbild  ')).toBe('serienbild.png')
        expect(filenameFromReferenceTitle('clip.mp3', 'Stranded Deep')).toBe('stranded-deep.mp3')
    })

    it('falls back when the title is blank or yields an empty slug', () => {
        expect(filenameFromReferenceTitle('download.mp3', '   ')).toBe('asset.mp3')
        expect(filenameFromReferenceTitle('download.mp3', '!!!')).toBe('asset.mp3')
    })

    it('works without an extension on the current name', () => {
        expect(filenameFromReferenceTitle('download', 'Folge 1')).toBe('folge-1')
    })

    it('caps the stem so the full name stays under 180 characters', () => {
        const longTitle = 'a'.repeat(200)
        const result = filenameFromReferenceTitle('download.mp3', longTitle)
        expect(result.length).toBeLessThanOrEqual(180)
        expect(result.endsWith('.mp3')).toBe(true)
        expect(result).toMatch(/^[a-z0-9-]+\.mp3$/)
    })
})
