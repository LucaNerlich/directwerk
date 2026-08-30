import {act, renderHook} from '@testing-library/react'
import {describe, expect, it} from 'vitest'

import {useEntityListSelection} from './use-entity-list-selection'

describe('useEntityListSelection', () => {
    it('does not restore a selection when an item leaves and re-enters the list', () => {
        const {result, rerender} = renderHook(
            ({itemIds}: {itemIds: number[]}) => useEntityListSelection(itemIds),
            {initialProps: {itemIds: [1, 2]}},
        )

        act(() => result.current.toggleSelection(2))
        expect(result.current.selectedIds.has(2)).toBe(true)

        rerender({itemIds: [1]})
        expect(result.current.selectedIds.has(2)).toBe(false)

        rerender({itemIds: [1, 2]})
        expect(result.current.selectedIds.has(2)).toBe(false)
    })
})
