'use client'

import {render, screen, waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {describe, expect, it, vi} from 'vitest'

import PublicationDangerZone from '@/components/publication/PublicationDangerZone'

const draftItem = {id: 1, slug: 'draft-slug', title: 'Draft', status: 'DRAFT' as const}

describe('PublicationDangerZone', () => {
    it('renders nothing without an item', () => {
        const {container} = render(
            <PublicationDangerZone
                contentLabel="Folge"
                deleteErrorMessage="Folge konnte nicht gelöscht werden."
                item={null}
                onDelete={vi.fn()}
                onDeleted={vi.fn()}
            />,
        )
        expect(container).toBeEmptyDOMElement()
    })

    it('deletes a draft after confirmation and calls onDeleted', async () => {
        const user = userEvent.setup()
        const onDelete = vi.fn().mockResolvedValue(undefined)
        const onDeleted = vi.fn()

        render(
            <PublicationDangerZone
                contentLabel="Folge"
                deleteErrorMessage="Folge konnte nicht gelöscht werden."
                item={draftItem}
                onDelete={onDelete}
                onDeleted={onDeleted}
            />,
        )

        await user.click(screen.getByRole('button', {name: 'Folge löschen…'}))
        await user.click(await screen.findByRole('button', {name: 'Löschen'}))

        await waitFor(() => {
            expect(onDelete).toHaveBeenCalledWith(1)
        })
        expect(onDeleted).toHaveBeenCalledTimes(1)
    })

    it('shows a German error with retry when deleting fails', async () => {
        const user = userEvent.setup()
        const onDelete = vi
            .fn()
            .mockRejectedValueOnce(new Error('Folge konnte nicht gelöscht werden.'))
            .mockResolvedValueOnce(undefined)
        const onDeleted = vi.fn()

        render(
            <PublicationDangerZone
                contentLabel="Folge"
                deleteErrorMessage="Folge konnte nicht gelöscht werden."
                item={draftItem}
                onDelete={onDelete}
                onDeleted={onDeleted}
            />,
        )

        await user.click(screen.getByRole('button', {name: 'Folge löschen…'}))
        await user.click(await screen.findByRole('button', {name: 'Löschen'}))

        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent(
                'Folge konnte nicht gelöscht werden.',
            )
        })
        expect(onDeleted).not.toHaveBeenCalled()

        await user.click(screen.getByRole('button', {name: 'Erneut versuchen'}))
        await user.click(await screen.findByRole('button', {name: 'Löschen'}))

        await waitFor(() => {
            expect(onDeleted).toHaveBeenCalledTimes(1)
        })
    })
})
