import {cleanup, render, screen} from '@testing-library/react'
import {afterEach, describe, expect, it} from 'vitest'

import de from '@/dictionaries/de.json'
import en from '@/dictionaries/en.json'
import {LocaleProvider} from '@/lib/i18n/LocaleProvider'

import LocalizedNotFound from './not-found'

afterEach(cleanup)

describe('LocalizedNotFound', () => {
    it.each([
        {lang: 'de' as const, dictionary: de},
        {lang: 'en' as const, dictionary: en},
    ])('uses the layout locale $lang for its message and home link', ({lang, dictionary}) => {
        render(
            <LocaleProvider lang={lang} dictionary={dictionary}>
                <LocalizedNotFound />
            </LocaleProvider>,
        )

        expect(screen.getByRole('heading', {name: dictionary.notFound.title})).toBeInTheDocument()
        expect(screen.getByText(dictionary.notFound.description)).toBeInTheDocument()
        expect(screen.getByText(dictionary.nav.toHome).closest('a')).toHaveAttribute('href', `/${lang}`)
    })
})
