'use client'

import {render, screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {describe, expect, it, vi} from 'vitest'

import DeletePublicationDialog from '@/components/publication/DeletePublicationDialog'

describe('DeletePublicationDialog', () => {
    it('confirms drafts with a simple dialog', async () => {
        const user = userEvent.setup()
        const onConfirm = vi.fn()
        const onOpenChange = vi.fn()

        render(
            <DeletePublicationDialog
                contentLabel="Folge"
                item={{id: 1, slug: 'draft-slug', title: 'Draft', status: 'DRAFT'}}
                onConfirm={onConfirm}
                onOpenChange={onOpenChange}
                open
                pending={false}
            />,
        )

        expect(screen.getByText('Folge löschen?')).toBeInTheDocument()
        await user.click(screen.getByRole('button', {name: 'Löschen'}))
        expect(onConfirm).toHaveBeenCalledTimes(1)
    })

    it('confirms archived items with a simple dialog', async () => {
        const user = userEvent.setup()
        const onConfirm = vi.fn()

        render(
            <DeletePublicationDialog
                contentLabel="Beitrag"
                item={{id: 2, slug: 'old-post', title: 'Old Post', status: 'ARCHIVED'}}
                onConfirm={onConfirm}
                onOpenChange={() => undefined}
                open
                pending={false}
            />,
        )

        await user.click(screen.getByRole('button', {name: 'Löschen'}))
        expect(onConfirm).toHaveBeenCalledTimes(1)
    })

    it('requires typing the slug for published items', async () => {
        const user = userEvent.setup()
        const onConfirm = vi.fn()

        render(
            <DeletePublicationDialog
                contentLabel="Folge"
                item={{id: 3, slug: 'my-episode', title: 'My Episode', status: 'PUBLISHED'}}
                onConfirm={onConfirm}
                onOpenChange={() => undefined}
                open
                pending={false}
            />,
        )

        const confirmButton = screen.getByRole('button', {name: 'Endgültig löschen'})
        expect(confirmButton).toBeDisabled()

        await user.type(screen.getByLabelText('Slug zur Bestätigung'), 'wrong-slug')
        expect(confirmButton).toBeDisabled()

        await user.clear(screen.getByLabelText('Slug zur Bestätigung'))
        await user.type(screen.getByLabelText('Slug zur Bestätigung'), 'my-episode')
        expect(confirmButton).toBeEnabled()

        await user.click(confirmButton)
        expect(onConfirm).toHaveBeenCalledTimes(1)
    })

    it('requires typing the slug for scheduled items', async () => {
        const user = userEvent.setup()
        const onConfirm = vi.fn()

        render(
            <DeletePublicationDialog
                contentLabel="Beitrag"
                item={{id: 4, slug: 'soon-post', title: 'Soon Post', status: 'SCHEDULED'}}
                onConfirm={onConfirm}
                onOpenChange={() => undefined}
                open
                pending={false}
            />,
        )

        const confirmButton = screen.getByRole('button', {name: 'Endgültig löschen'})
        expect(confirmButton).toBeDisabled()

        await user.type(screen.getByLabelText('Slug zur Bestätigung'), 'soon-post')
        await user.click(confirmButton)
        expect(onConfirm).toHaveBeenCalledTimes(1)
    })

    it('disables actions while the delete is pending', async () => {
        const onConfirm = vi.fn()

        render(
            <DeletePublicationDialog
                contentLabel="Folge"
                item={{id: 5, slug: 'live-episode', title: 'Live', status: 'PUBLISHED'}}
                onConfirm={onConfirm}
                onOpenChange={() => undefined}
                open
                pending
            />,
        )

        expect(screen.getByRole('button', {name: 'Wird gelöscht…'})).toBeDisabled()
        expect(screen.getByRole('button', {name: 'Abbrechen'})).toBeDisabled()
    })
})
