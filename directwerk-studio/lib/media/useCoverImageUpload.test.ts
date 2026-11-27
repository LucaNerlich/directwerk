import {act, renderHook, waitFor} from '@testing-library/react'
import {describe, expect, it, vi} from 'vitest'

const mocks = vi.hoisted(() => ({
    getClientTenantHost: vi.fn(),
    getMediaUploadLimits: vi.fn(),
    uploadMediaFile: vi.fn(),
}))

vi.mock('@directwerk/api/tenant', () => ({getClientTenantHost: mocks.getClientTenantHost}))
vi.mock('@/lib/api/mediaApi', () => ({getMediaUploadLimits: mocks.getMediaUploadLimits}))
vi.mock('@/lib/media/upload', () => ({uploadMediaFile: mocks.uploadMediaFile}))

import {useCoverImageUpload} from './useCoverImageUpload'

describe('useCoverImageUpload', () => {
    it('passes the tenant limits to uploadMediaFile once they arrive', async () => {
        mocks.getClientTenantHost.mockReturnValue('tenant.test')
        mocks.getMediaUploadLimits.mockResolvedValue({
            maxAudioBytes: 5 * 1024 * 1024 * 1024,
            maxImageBytes: 20 * 1024 * 1024,
            maxVideoBytes: 5 * 1024 * 1024 * 1024,
            maxDocumentBytes: 50 * 1024 * 1024,
        })
        mocks.uploadMediaFile.mockResolvedValue({id: 7})
        const {result} = renderHook(() =>
            useCoverImageUpload({onUploaded: vi.fn(), onError: vi.fn()}),
        )

        await waitFor(() => expect(result.current.limits.IMAGE.maxBytes).toBe(20 * 1024 * 1024))
        await act(async () => {
            await result.current.upload(new File(['x'], 'cover.png', {type: 'image/png'}))
        })

        expect(mocks.uploadMediaFile).toHaveBeenCalledWith(
            'tenant.test',
            expect.any(File),
            expect.objectContaining({
                limits: expect.objectContaining({
                    IMAGE: {maxBytes: 20 * 1024 * 1024, label: '20 MB'},
                }),
            }),
        )
    })
})
