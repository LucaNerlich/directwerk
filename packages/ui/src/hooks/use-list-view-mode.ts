'use client'

import {useState} from 'react'

import type {ViewMode} from '#components/view-mode-toggle'

export function useListViewMode(initialMode: ViewMode = 'list') {
    const [viewMode, setViewMode] = useState<ViewMode>(initialMode)

    return {
        viewMode,
        setViewMode,
    }
}
