import {render, screen} from '@testing-library/react'
import {describe, expect, it} from 'vitest'

import {FieldError, FieldHint} from './field'

describe('field helpers', () => {
    it('announces errors as alerts', () => {
        render(<FieldError>Titel ist erforderlich.</FieldError>)

        const error = screen.getByRole('alert')
        expect(error).toHaveTextContent('Titel ist erforderlich.')
        expect(error).toHaveClass('text-destructive')
    })

    it('renders hints without an alert role', () => {
        render(<FieldHint>Mindestens 3 Zeichen.</FieldHint>)

        const hint = screen.getByText('Mindestens 3 Zeichen.')
        expect(hint).not.toHaveAttribute('role')
        expect(hint).toHaveClass('text-muted-foreground')
    })
})
