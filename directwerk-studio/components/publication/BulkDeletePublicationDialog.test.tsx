'use client'

import {render, screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {describe, expect, it, vi} from 'vitest'

import BulkDeletePublicationDialog from '@/components/publication/BulkDeletePublicationDialog'

describe('BulkDeletePublicationDialog', () => {
    it('confirms draft-only selections with a simple dialog', async () => {
        const user = userEvent.setup()
        const onConfirm = vi.fn()

        render(
            <BulkDeletePublicationDialog
                contentLabel="Folge"
                contentLabelPlural="Folgen"
                items={[
                    {id: 1, title: 'Draft One', status: 'DRAFT'},
                    {id: 3, title: 'Draft Two', status: 'DRAFT'},
                ]}
                onConfirm={onConfirm}
                onOpenChange={() => undefined}
                open
                pending={false}
            />,
        )

        expect(screen.getByText('Folge löschen?')).toBeInTheDocument()
        await user.click(screen.getByRole('button', {name: 'Alle 2 löschen'}))
        expect(onConfirm).toHaveBeenCalledTimes(1)
    })

    it('requires typing LÖSCHEN when a visible item is included', async () => {
        const user = userEvent.setup()
        const onConfirm = vi.fn()

        render(
            <BulkDeletePublicationDialog
                contentLabel="Beitrag"
                contentLabelPlural="Beiträge"
                items={[
                    {id: 1, title: 'Draft', status: 'DRAFT'},
                    {id: 2, title: 'Live', status: 'PUBLISHED'},
                ]}
                onConfirm={onConfirm}
                onOpenChange={() => undefined}
                open
                pending={false}
            />,
        )

        const confirmButton = screen.getByRole('button', {
            name: 'Alle 2 endgültig löschen',
        })
        expect(confirmButton).toBeDisabled()

        await user.type(screen.getByLabelText('Bestätigung'), 'LÖSCHEN')
        expect(confirmButton).toBeEnabled()

        await user.click(confirmButton)
        expect(onConfirm).toHaveBeenCalledTimes(1)
    })

    it('renders nothing without items', () => {
        const {container} = render(
            <BulkDeletePublicationDialog
                contentLabel="Folge"
                contentLabelPlural="Folgen"
                items={[]}
                onConfirm={() => undefined}
                onOpenChange={() => undefined}
                open
                pending={false}
            />,
        )

        expect(container).toBeEmptyDOMElement()
    })
})
