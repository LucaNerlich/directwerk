'use client'

import {useCallback, useMemo, useState} from 'react'

export type PublicationListViewMode = 'list' | 'grid'

export function usePublicationListSelection(itemIds: number[]) {
    const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set())
    const [viewMode, setViewMode] = useState<PublicationListViewMode>('list')

    const visibleIdSet = useMemo(() => new Set(itemIds), [itemIds])

    const prunedSelectedIds = useMemo(() => {
        const next = new Set<number>()
        for (const id of selectedIds) {
            if (visibleIdSet.has(id)) {
                next.add(id)
            }
        }
        return next
    }, [selectedIds, visibleIdSet])

    const selectedCount = prunedSelectedIds.size
    const allSelected = itemIds.length > 0 && selectedCount === itemIds.length
    const someSelected = selectedCount > 0 && !allSelected

    const toggleSelection = useCallback((id: number) => {
        setSelectedIds((current) => {
            const next = new Set(current)
            if (next.has(id)) {
                next.delete(id)
            } else {
                next.add(id)
            }
            return next
        })
    }, [])

    const toggleSelectAll = useCallback(() => {
        setSelectedIds((current) => {
            const allCurrentlySelected =
                itemIds.length > 0 && itemIds.every((id) => current.has(id))
            if (allCurrentlySelected) {
                return new Set()
            }
            return new Set(itemIds)
        })
    }, [itemIds])

    const clearSelection = useCallback(() => {
        setSelectedIds(new Set())
    }, [])

    return {
        selectedIds: prunedSelectedIds,
        selectedCount,
        allSelected,
        someSelected,
        viewMode,
        setViewMode,
        toggleSelection,
        toggleSelectAll,
        clearSelection,
    }
}
