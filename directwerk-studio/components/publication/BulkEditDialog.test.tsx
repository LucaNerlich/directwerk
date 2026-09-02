import {cleanup, render, screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {afterEach, describe, expect, it, vi} from 'vitest'

import BulkEditDialog from '@/components/publication/BulkEditDialog'
import type {CategorySummary, FormatSummary} from '@directwerk/api/types'

const mockFormats: FormatSummary[] = [
    {
        id: 1,
        slug: 'hauptfolge',
        name: 'Hauptfolge',
        active: true,
        description: null,
        requiredLevelSortOrder: null,
        sortOrder: 0,
        coverAssetId: null,
    },
]

const mockCategories: CategorySummary[] = [
    {id: 11, slug: 'news', name: 'News', parentId: null, active: true},
    {id: 12, slug: 'stories', name: 'Stories', parentId: null, active: true},
]

describe('BulkEditDialog', () => {
    afterEach(() => {
        cleanup()
        vi.clearAllMocks()
    })

    it('disables apply until a format is selected and applies the format operation', async () => {
        const user = userEvent.setup()
        const onApply = vi.fn()

        render(
            <BulkEditDialog
                busy={false}
                categories={mockCategories}
                contentLabel="Folge"
                draftCount={2}
                formats={mockFormats}
                onApply={onApply}
                onOpenChange={vi.fn()}
                open
                selectedCount={2}
            />,
        )

        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(screen.getByRole('button', {name: 'Anwenden'})).toBeDisabled()

        await user.click(screen.getByRole('checkbox', {name: 'Hauptfolge'}))

        expect(screen.getByRole('button', {name: 'Anwenden'})).toBeEnabled()

        await user.click(screen.getByRole('button', {name: 'Anwenden'}))

        expect(onApply).toHaveBeenCalledWith({formatIds: [1], kind: 'formats'})
    })

    it('shows a hint when published items are skipped', async () => {
        render(
            <BulkEditDialog
                busy={false}
                categories={mockCategories}
                contentLabel="Beitrag"
                draftCount={1}
                onApply={vi.fn()}
                onOpenChange={vi.fn()}
                open
                selectedCount={3}
            />,
        )

        expect(
            screen.getByText(
                '1 von 3 ausgewählten Beiträgen sind Entwürfe — veröffentlichte Beiträge werden übersprungen.',
            ),
        ).toBeInTheDocument()
    })

    it('disables apply when no drafts are selected', () => {
        const onApply = vi.fn()

        render(
            <BulkEditDialog
                busy={false}
                categories={mockCategories}
                contentLabel="Folge"
                draftCount={0}
                formats={mockFormats}
                onApply={onApply}
                onOpenChange={vi.fn()}
                open
                selectedCount={2}
            />,
        )

        expect(
            screen.getByText(
                '0 von 2 ausgewählten Folgen sind Entwürfe — veröffentlichte Folgen werden übersprungen.',
            ),
        ).toBeInTheDocument()
        expect(screen.getByRole('button', {name: 'Anwenden'})).toBeDisabled()
    })

    it('applies a category operation', async () => {
        const user = userEvent.setup()
        const onApply = vi.fn()

        render(
            <BulkEditDialog
                busy={false}
                categories={mockCategories}
                contentLabel="Folge"
                draftCount={1}
                onApply={onApply}
                onOpenChange={vi.fn()}
                open
                selectedCount={1}
            />,
        )

        await user.click(screen.getByRole('checkbox', {name: 'News'}))
        await user.click(screen.getByRole('button', {name: 'Anwenden'}))

        expect(onApply).toHaveBeenCalledWith({categoryIds: [11], kind: 'categories'})
    })

    it('applies the access policy operation', async () => {
        const user = userEvent.setup()
        const onApply = vi.fn()

        render(
            <BulkEditDialog
                busy={false}
                categories={[]}
                contentLabel="Beitrag"
                draftCount={1}
                onApply={onApply}
                onOpenChange={vi.fn()}
                open
                selectedCount={1}
            />,
        )

        await user.click(screen.getByRole('radio', {name: 'Bezahlt'}))
        await user.click(screen.getByRole('button', {name: 'Anwenden'}))

        expect(onApply).toHaveBeenCalledWith({accessPolicy: 'PAID', kind: 'accessPolicy'})
    })
})
