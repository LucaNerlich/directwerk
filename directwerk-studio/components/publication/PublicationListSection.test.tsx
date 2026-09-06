import {render, screen} from '@testing-library/react'
import {describe, expect, it, vi} from 'vitest'

import PublicationListSection from './PublicationListSection'

interface CoverTestItem {
    id: number
    slug: string
    title: string
    status: 'PUBLISHED'
    publishedAt: null
    coverImageUrl?: string | null
}

const baseItem: Omit<CoverTestItem, 'id' | 'coverImageUrl'> = {
    slug: 'folge-1',
    title: 'Folge 1',
    status: 'PUBLISHED',
    publishedAt: null,
}

function renderSection(viewMode: 'grid' | 'list', items: CoverTestItem[]) {
    return render(
        <PublicationListSection
            allSelected={false}
            busyItemId={null}
            contentLabelPlural="Folgen"
            editorBasePath="/podcast/episodes"
            isBulkBusy={false}
            items={items}
            publishableCount={0}
            selectedIds={new Set<number>()}
            unpublishableCount={0}
            viewMode={viewMode}
            onBulkPublish={vi.fn()}
            onBulkUnpublish={vi.fn()}
            onPublish={vi.fn()}
            onToggleSelectAll={vi.fn()}
            onToggleSelection={vi.fn()}
            onUnpublish={vi.fn()}
            onViewModeChange={vi.fn()}
        />,
    )
}

describe('PublicationListSection covers', () => {
    it.each(['grid', 'list'] as const)(
        'shows the cover image in %s view when the URL is present',
        (viewMode) => {
            renderSection(viewMode, [
                {...baseItem, id: 1, coverImageUrl: 'https://cdn.test/covers/ep-1.jpg'},
                {...baseItem, id: 2, title: 'Folge 2', coverImageUrl: null},
            ])

            const images = screen.getAllByRole('img')
            expect(images).toHaveLength(1)
            expect(images[0]).toHaveAttribute(
                'src',
                'https://cdn.test/covers/ep-1.jpg',
            )
        },
    )

    it('renders no image when no item has a cover URL', () => {
        renderSection('grid', [{...baseItem, id: 1}])

        expect(screen.queryByRole('img')).not.toBeInTheDocument()
    })
})
