import {describe, expect, it} from 'vitest'

import {
    buildUploadUrlBody,
    inferAssetType,
    parseBrowserUploadHeaders,
} from '../src/media/uploadProtocol'

function headers(entries: Record<string, string>): Headers {
    return new Headers(entries)
}

describe('inferAssetType', () => {
    it('maps mime families', () => {
        expect(inferAssetType('image/png')).toBe('IMAGE')
        expect(inferAssetType('audio/mpeg')).toBe('AUDIO')
        expect(inferAssetType('video/mp4')).toBe('VIDEO')
        expect(inferAssetType('application/pdf')).toBe('DOCUMENT')
    })
})

describe('parseBrowserUploadHeaders', () => {
    it('parses a valid private document upload', () => {
        const result = parseBrowserUploadHeaders(
            headers({
                'x-filename': encodeURIComponent('notes.pdf'),
                'content-length': '1024',
                'content-type': 'application/pdf; charset=binary',
                'x-visibility': 'PRIVATE',
            }),
        )

        expect(result.ok).toBe(true)
        if (!result.ok) {
            return
        }
        expect(result.value.filename).toBe('notes.pdf')
        expect(result.value.sizeBytes).toBe(1024)
        expect(result.value.mimeType).toBe('application/pdf')
        expect(result.value.assetType).toBe('DOCUMENT')
        expect(result.value.visibility).toBe('PRIVATE')
    })

    it('infers the asset type and scope for public uploads', () => {
        const result = parseBrowserUploadHeaders(
            headers({
                'x-filename': encodeURIComponent('cover.png'),
                'content-length': '2048',
                'content-type': 'image/png',
                'x-visibility': 'PUBLIC',
            }),
        )

        expect(result.ok).toBe(true)
        if (!result.ok) {
            return
        }
        expect(result.value.assetType).toBe('IMAGE')
        expect(buildUploadUrlBody(result.value)).toMatchObject({
            intendedVisibility: 'PUBLIC',
            scope: 'TENANT_PUBLIC',
        })
    })

    it('rejects malformed input with a structured status', () => {
        expect(
            parseBrowserUploadHeaders(headers({'content-length': '1'})),
        ).toMatchObject({ok: false, status: 400})
        expect(
            parseBrowserUploadHeaders(
                headers({
                    'x-filename': encodeURIComponent('a.txt'),
                    'content-type': 'text/plain',
                }),
            ),
        ).toMatchObject({ok: false, status: 411})
        expect(
            parseBrowserUploadHeaders(
                headers({
                    'x-filename': encodeURIComponent('a.txt'),
                    'content-length': '1',
                    'x-visibility': 'SECRET',
                }),
            ),
        ).toMatchObject({ok: false, status: 400, error: 'Choose a valid visibility.'})
        expect(
            parseBrowserUploadHeaders(
                headers({
                    'x-filename': encodeURIComponent('a.txt'),
                    'content-length': '1',
                    'x-episode-id': '0',
                }),
            ),
        ).toMatchObject({ok: false, status: 400, error: 'Invalid episodeId.'})
    })

    it('carries valid optional ids through to the upload-url body', () => {
        const result = parseBrowserUploadHeaders(
            headers({
                'x-filename': encodeURIComponent('ep.mp3'),
                'content-length': '4096',
                'content-type': 'audio/mpeg',
                'x-asset-type': 'AUDIO',
                'x-episode-id': '7',
                'x-folder-id': '3',
            }),
        )

        expect(result.ok).toBe(true)
        if (!result.ok) {
            return
        }
        expect(result.value).toMatchObject({episodeId: 7, folderId: 3})
        expect(buildUploadUrlBody(result.value)).toMatchObject({
            scope: 'CONTENT',
            episodeId: 7,
            folderId: 3,
        })
    })
})
