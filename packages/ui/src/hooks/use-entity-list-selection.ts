'use client'

import {useCallback, useEffect, useMemo, useState} from 'react'

import type {ViewMode} from '#components/view-mode-toggle'

export type EntityListItemId = number | string

export function useEntityListSelection<T extends EntityListItemId>(itemIds: T[]) {
    const [selectedIds, setSelectedIds] = useState<Set<T>>(() => new Set())
    const [viewMode, setViewMode] = useState<ViewMode>('list')

    const visibleIdSet = useMemo(() => new Set(itemIds), [itemIds])

    useEffect(() => {
        setSelectedIds((current) => {
            const next = new Set(
                [...current].filter((id) => visibleIdSet.has(id)),
            )
            return next.size === current.size ? current : next
        })
    }, [visibleIdSet])

    const prunedSelectedIds = useMemo(() => {
        const next = new Set<T>()
        for (const id of selectedIds) {
            if (visibleIdSet.has(id)) {
                next.add(id)
            }
        }
        return next
    }, [selectedIds, visibleIdSet])

    const selectedCount = prunedSelectedIds.size
    const allSelected = itemIds.length > 0 && selectedCount === itemIds.length

    const toggleSelection = useCallback((id: T) => {
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
        viewMode,
        setViewMode,
        toggleSelection,
        toggleSelectAll,
        clearSelection,
    }
}
