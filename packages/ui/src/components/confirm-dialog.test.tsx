import {fireEvent, render, screen} from '@testing-library/react'
import {describe, expect, it, vi} from 'vitest'

import ConfirmDialog from './confirm-dialog'

function renderDialog(
    overrides: Partial<React.ComponentProps<typeof ConfirmDialog>> = {},
) {
    const onOpenChange = vi.fn()
    const onConfirm = vi.fn()

    render(
        <ConfirmDialog
            cancelLabel="Abbrechen"
            confirmLabel="Löschen"
            description="Dieser Vorgang kann nicht rückgängig gemacht werden."
            onConfirm={onConfirm}
            onOpenChange={onOpenChange}
            open
            title="Wirklich löschen?"
            {...overrides}
        />,
    )

    return {onConfirm, onOpenChange}
}

describe('ConfirmDialog', () => {
    it('renders title, description, and both actions', () => {
        renderDialog()

        expect(screen.getByText('Wirklich löschen?')).toBeInTheDocument()
        expect(
            screen.getByRole('button', {name: 'Abbrechen'}),
        ).toBeInTheDocument()
        expect(screen.getByRole('button', {name: 'Löschen'})).toBeInTheDocument()
    })

    it('confirms and cancels through the provided callbacks', () => {
        const {onConfirm, onOpenChange} = renderDialog()

        fireEvent.click(screen.getByRole('button', {name: 'Löschen'}))
        expect(onConfirm).toHaveBeenCalledTimes(1)

        fireEvent.click(screen.getByRole('button', {name: 'Abbrechen'}))
        expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    it('disables actions and shows the pending label while pending', () => {
        renderDialog({pending: true, pendingLabel: 'Wird gelöscht…'})

        expect(
            screen.getByRole('button', {name: 'Wird gelöscht…'}),
        ).toBeDisabled()
        expect(screen.getByRole('button', {name: 'Abbrechen'})).toBeDisabled()
    })
})
