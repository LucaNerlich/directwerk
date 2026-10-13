// @vitest-environment jsdom

import {cleanup, renderHook, waitFor} from '@testing-library/react'
import {afterEach, describe, expect, it, vi} from 'vitest'

import {useAuthedQuery} from '../src/client/useAuthedQuery'

vi.mock('../src/auth/useAuthRequired', () => {
    const authRedirect = () => false
    return {useAuthRequired: () => authRedirect}
})

afterEach(() => {
    cleanup()
})

describe('useAuthedQuery', () => {
    it('uses fallbackError when a configured mapper returns null', async () => {
        const {result} = renderHook(() => useAuthedQuery(
            () => Promise.reject(new Error('internal detail')),
            {fallbackError: 'Public fallback', mapError: () => null},
        ))

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        expect(result.current.error).toBe('Public fallback')
    })

    it('preserves thrown Error messages when no mapper is configured', async () => {
        const {result} = renderHook(() => useAuthedQuery(
            () => Promise.reject(new Error('Visible error')),
            {fallbackError: 'Public fallback'},
        ))

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        expect(result.current.error).toBe('Visible error')
    })

    it('never reports isLoading alongside resolved data on success', async () => {
        // #334: the .then branch used to publish `{data, isLoading: true}` before .finally
        // flipped it, so consumers rendering `isLoading ? spinner : data` flashed a spinner
        // over loaded content.
        const observed: Array<{data: string | null; isLoading: boolean}> = []
        const {result} = renderHook(() => {
            const state = useAuthedQuery(() => Promise.resolve('loaded'), {})
            observed.push({data: state.data, isLoading: state.isLoading})
            return state
        })

        await waitFor(() => expect(result.current.data).toBe('loaded'))

        expect(observed.some(({data, isLoading}) => data !== null && isLoading)).toBe(false)
        expect(result.current.isLoading).toBe(false)
    })

    it('refetches for a new query identity without retaining the previous result', async () => {
        const fetcher = vi.fn((id: number) => Promise.resolve(`item-${id}`))
        const {result, rerender} = renderHook(
            ({id}) => useAuthedQuery(() => fetcher(id), {queryKey: `item:${id}`}),
            {initialProps: {id: 1}},
        )
        await waitFor(() => expect(result.current.data).toBe('item-1'))

        rerender({id: 2})

        expect(result.current.data).toBeNull()
        expect(result.current.isLoading).toBe(true)
        await waitFor(() => expect(result.current.data).toBe('item-2'))
        expect(fetcher).toHaveBeenCalledTimes(2)
    })
})
