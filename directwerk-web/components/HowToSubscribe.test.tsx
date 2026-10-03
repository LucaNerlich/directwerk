import {cleanup, render, screen} from '@testing-library/react'
import {afterEach, describe, expect, it} from 'vitest'

import HowToSubscribe from '@/components/HowToSubscribe'
import {TestLocale} from '@/lib/i18n/testWrapper'

afterEach(cleanup)

describe('HowToSubscribe', () => {
    it('renders podcast-only instructions', () => {
        render(<TestLocale><HowToSubscribe podcast /></TestLocale>)

        expect(
            screen.getByRole('heading', {name: 'So hörst du in der Podcast-App'}),
        ).toBeInTheDocument()
        expect(
            screen.queryByRole('heading', {name: 'So liest du im Feed-Reader'}),
        ).not.toBeInTheDocument()
        expect(screen.queryByText(/Öffentlicher Standard-Feed/)).not.toBeInTheDocument()
    })

    it('renders article instructions without URLs', () => {
        render(<TestLocale><HowToSubscribe articles /></TestLocale>)

        expect(
            screen.getByRole('heading', {name: 'So liest du im Feed-Reader'}),
        ).toBeInTheDocument()
        expect(
            screen.queryByRole('heading', {name: 'So hörst du in der Podcast-App'}),
        ).not.toBeInTheDocument()
        expect(screen.queryByRole('button', {name: /Kopieren/i})).not.toBeInTheDocument()
    })

    it('renders both blocks together', () => {
        render(<TestLocale><HowToSubscribe podcast articles /></TestLocale>)

        expect(
            screen.getByRole('heading', {name: 'So hörst du in der Podcast-App'}),
        ).toBeInTheDocument()
        expect(
            screen.getByRole('heading', {name: 'So liest du im Feed-Reader'}),
        ).toBeInTheDocument()
    })

    it('renders nothing without any feed kind', () => {
        const {container} = render(<TestLocale><HowToSubscribe /></TestLocale>)
        expect(container).toBeEmptyDOMElement()
    })
})
