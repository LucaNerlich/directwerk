'use client'

import {useEntityListSelection} from '@directwerk/ui/hooks/use-entity-list-selection'
import {useListViewMode} from '@directwerk/ui/hooks/use-list-view-mode'

export function usePublicationListState(itemIds: number[]) {
    const selection = useEntityListSelection<number>(itemIds)
    const view = useListViewMode()

    return {...selection, ...view}
}
