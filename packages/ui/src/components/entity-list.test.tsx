import {render, screen} from '@testing-library/react'
import {describe, expect, it, vi} from 'vitest'

import {EntityListToolbar} from './entity-list-toolbar'
import {EntityListView} from './entity-list-view'

describe('entity list components', () => {
    it('keeps numeric selection callbacks type-safe and uses explicit selection labels', () => {
        const onToggleSelection = vi.fn<(id: number) => void>()

        render(
            <EntityListView<number>
                items={[
                    {
                        id: 7,
                        title: <span>Rendered title</span>,
                        selectionLabel: 'Media file',
                    },
                ]}
                onToggleSelection={onToggleSelection}
                selectable
                selectedIds={new Set([7])}
                viewMode="grid"
            />,
        )

        const checkbox = screen.getByRole('checkbox', {
            name: '„Media file“ auswählen',
        })
        expect(checkbox).toBeChecked()
        expect(checkbox.closest('[data-slot="card"]')).toHaveClass(
            'h-full',
            'ring-2',
            'ring-primary',
        )
    })

    it('marks a partial select-all state as indeterminate', () => {
        render(
            <EntityListToolbar
                allSelected={false}
                onToggleSelectAll={vi.fn()}
                selectAllLabel="Alle Medien auswählen"
                selectedCount={1}
                showViewToggle={false}
            />,
        )

        expect(
            screen.getByRole('checkbox', {name: 'Alle Medien auswählen'}),
        ).toHaveAttribute('aria-checked', 'mixed')
    })
})
