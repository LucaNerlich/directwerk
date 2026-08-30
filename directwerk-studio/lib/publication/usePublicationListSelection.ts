'use client'

import type {ViewMode} from '@directwerk/ui/components/view-mode-toggle'
import {useEntityListSelection} from '@directwerk/ui/hooks/use-entity-list-selection'

export type PublicationListViewMode = ViewMode

export function usePublicationListSelection(itemIds: number[]) {
    return useEntityListSelection<number>(itemIds)
}
