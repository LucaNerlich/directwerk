'use client'

import {useEntityListSelection} from '@directwerk/ui/hooks/use-entity-list-selection'
import {useListViewMode} from '@directwerk/ui/hooks/use-list-view-mode'
import type {ViewMode} from '@directwerk/ui/components/view-mode-toggle'

export type PublicationListViewMode = ViewMode

export function usePublicationListState(itemIds: number[]) {
    const selection = useEntityListSelection<number>(itemIds)
    const view = useListViewMode()

    return {...selection, ...view}
}
