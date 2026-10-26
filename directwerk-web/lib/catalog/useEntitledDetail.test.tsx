import {act, cleanup, renderHook, waitFor} from '@testing-library/react'
import {afterEach, describe, expect, it, vi} from 'vitest'

import {useEntitledDetail} from '@/lib/catalog/useEntitledDetail'

afterEach(() => {
    cleanup()
    vi.clearAllMocks()
})

const messages = {
    emptySlug: 'empty',
    loadFailed: 'failed',
    authRequired: 'auth',
}

describe('useEntitledDetail', () => {
    it('keeps SSR seed ready while authenticated entitled fetch runs', async () => {
        const initial = {slug: 'ep-1'}
        const loadEntitled = vi.fn().mockResolvedValue({slug: 'ep-1-entitled'})
        const loadPublic = vi.fn()

        const {result} = renderHook(() =>
            useEntitledDetail({
                slug: 'ep-1',
                initial,
                isAuthenticated: true,
                tenantHost: 'tenant.example',
                loadPublic,
                loadEntitled,
                messages,
            }),
        )

        expect(result.current.status).toBe('ready')
        expect(result.current.item).toEqual({slug: 'ep-1'})
        expect(loadPublic).not.toHaveBeenCalled()

        await waitFor(() =>
            expect(result.current.item).toEqual({slug: 'ep-1-entitled'}),
        )
        expect(result.current.status).toBe('ready')
        expect(loadEntitled).toHaveBeenCalled()
    })

    it('does not blank to loading when SSR seed exists for subscribers', async () => {
        const initial = {slug: 'ep-1'}
        let resolveEntitled!: (value: {slug: string} | null) => void
        const loadEntitled = vi.fn(
            () =>
                new Promise<{slug: string} | null>((resolve) => {
                    resolveEntitled = resolve
                }),
        )

        const {result} = renderHook(() =>
            useEntitledDetail({
                slug: 'ep-1',
                initial,
                isAuthenticated: true,
                tenantHost: 'tenant.example',
                loadPublic: vi.fn(),
                loadEntitled,
                messages,
            }),
        )

        expect(result.current.status).toBe('ready')
        await waitFor(() => expect(loadEntitled).toHaveBeenCalled())
        expect(result.current.status).toBe('ready')
        expect(result.current.item).toEqual({slug: 'ep-1'})

        await act(async () => {
            resolveEntitled({slug: 'ep-1-entitled'})
        })
        expect(result.current.item).toEqual({slug: 'ep-1-entitled'})
    })

    it('skips fetch for anonymous viewers when SSR seed exists', () => {
        const initial = {slug: 'ep-1'}
        const loadEntitled = vi.fn()
        const loadPublic = vi.fn()

        const {result} = renderHook(() =>
            useEntitledDetail({
                slug: 'ep-1',
                initial,
                isAuthenticated: false,
                tenantHost: 'tenant.example',
                loadPublic,
                loadEntitled,
                messages,
            }),
        )

        expect(result.current.status).toBe('ready')
        expect(loadPublic).not.toHaveBeenCalled()
        expect(loadEntitled).not.toHaveBeenCalled()
    })
})
