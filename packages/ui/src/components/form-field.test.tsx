import {render, screen} from '@testing-library/react'
import {describe, expect, it} from 'vitest'

import {Input} from './input'
import FormField from './form-field'

describe('FormField', () => {
    it('associates a hint message via aria-describedby', () => {
        render(
            <FormField htmlFor="email" label="Email" hint="We never share it.">
                <Input id="email" type="email" />
            </FormField>,
        )

        expect(screen.getByLabelText('Email')).toHaveAttribute(
            'aria-describedby',
            'email-message',
        )
    })

    it('keeps a child’s own aria-describedby when no hint or error is set', () => {
        render(
            <FormField htmlFor="email" label="Email">
                <Input id="email" type="email" aria-describedby="custom-description" />
            </FormField>,
        )

        expect(screen.getByLabelText('Email')).toHaveAttribute(
            'aria-describedby',
            'custom-description',
        )
    })

    it('appends the message id to a child’s own aria-describedby', () => {
        render(
            <FormField htmlFor="email" label="Email" error="Required">
                <Input id="email" type="email" aria-describedby="custom-description" />
            </FormField>,
        )

        const input = screen.getByLabelText('Email')
        expect(input).toHaveAttribute('aria-invalid', 'true')
        expect(input.getAttribute('aria-describedby')?.split(' ')).toEqual([
            'custom-description',
            'email-message',
        ])
    })
})
