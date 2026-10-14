'use client'

import {screen, waitFor} from '@testing-library/react'
import {renderWithLocale} from '@/lib/i18n/testUtils'
import userEvent from '@testing-library/user-event'
import {describe, expect, it, vi} from 'vitest'

import PublicationDangerZone from '@/components/publication/PublicationDangerZone'

const draftItem = {id: 1, slug: 'draft-slug', title: 'Draft', status: 'DRAFT' as const}

describe('PublicationDangerZone', () => {
    it('renders the English warning copy under the EN locale (#336)', () => {
        // The reported symptom was English users seeing hardcoded German. Assert the copy comes
        // from the dictionary for the active locale, not from a literal in the component.
        renderWithLocale(
            <PublicationDangerZone
                contentLabel="Episode"
                deleteErrorMessage="Could not delete the episode."
                item={draftItem}
                onDelete={vi.fn()}
                onDeleted={vi.fn()}
            />,
            {lang: 'en'},
        )

        expect(
            screen.getByText(
                'Permanent and irreversible — including all publications in the feed.',
            ),
        ).toBeInTheDocument()
    })

    it('renders nothing without an item', () => {
        const {container} = renderWithLocale(
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

        renderWithLocale(
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

        renderWithLocale(
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

        // The dialog stays open on failure, so the retry happens directly
        // from the dialog (the card-level retry sits behind the modal).
        await user.click(await screen.findByRole('button', {name: 'Löschen'}))

        await waitFor(() => {
            expect(onDeleted).toHaveBeenCalledTimes(1)
        })
    })

    it('keeps a published item dialog open on failure so the typed slug survives', async () => {
        const user = userEvent.setup()
        const publishedItem = {
            id: 9,
            slug: 'live-folge',
            title: 'Live Folge',
            status: 'PUBLISHED' as const,
        }
        const onDelete = vi
            .fn()
            .mockRejectedValueOnce(new Error('Löschen fehlgeschlagen.'))
            .mockResolvedValueOnce(undefined)
        const onDeleted = vi.fn()

        renderWithLocale(
            <PublicationDangerZone
                contentLabel="Folge"
                deleteErrorMessage="Folge konnte nicht gelöscht werden."
                item={publishedItem}
                onDelete={onDelete}
                onDeleted={onDeleted}
            />,
        )

        await user.click(screen.getByRole('button', {name: 'Folge löschen…'}))
        await user.type(
            await screen.findByLabelText('Slug zur Bestätigung'),
            'live-folge',
        )
        await user.click(screen.getByRole('button', {name: 'Endgültig löschen'}))

        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent('Löschen fehlgeschlagen.')
        })
        // Dialog stays open with the typed slug intact for a direct retry.
        const confirmButton = screen.getByRole('button', {name: 'Endgültig löschen'})
        expect(confirmButton).toBeEnabled()
        await user.click(confirmButton)

        await waitFor(() => {
            expect(onDeleted).toHaveBeenCalledTimes(1)
        })
    })
})
