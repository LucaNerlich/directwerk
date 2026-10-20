import {act, renderHook} from '@testing-library/react'
import {describe, expect, it} from 'vitest'

import {useTwoStepConfirm} from './useTwoStepConfirm'

describe('useTwoStepConfirm', () => {
    it('requires a second call for the same id before confirming', () => {
        const {result} = renderHook(() => useTwoStepConfirm<number>())

        let first = false
        act(() => {
            first = result.current.arm(9)
        })
        expect(first).toBe(false)
        expect(result.current.pending).toBe(9)

        let second = false
        act(() => {
            second = result.current.arm(9)
        })
        expect(second).toBe(true)
    })

    it('re-arms when a different id is clicked', () => {
        const {result} = renderHook(() => useTwoStepConfirm<number>())

        act(() => {
            result.current.arm(9)
        })
        let other = true
        act(() => {
            other = result.current.arm(10)
        })

        expect(other).toBe(false)
        expect(result.current.pending).toBe(10)
    })
})
