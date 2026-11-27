import {render, screen} from '@testing-library/react'
import {describe, expect, it, vi} from 'vitest'

import {TestLocale} from '@/lib/i18n/testWrapper'

const navigation = {
    pathname: '/de/pricing',
    search: new URLSearchParams('buy=pro'),
}

vi.mock('next/navigation', () => ({
    usePathname: () => navigation.pathname,
    useSearchParams: () => navigation.search,
}))

import LanguageSwitcher from './LanguageSwitcher'

describe('LanguageSwitcher', () => {
    it('keeps the current query string on the other locale', () => {
        const {rerender} = render(
            <TestLocale><LanguageSwitcher layout="row" /></TestLocale>,
        )

        expect(screen.getByRole('link', {name: 'English'})).toHaveAttribute(
            'href',
            '/en/pricing?buy=pro',
        )

        navigation.search = new URLSearchParams('buy=team')
        rerender(<TestLocale><LanguageSwitcher layout="row" /></TestLocale>)

        expect(screen.getByRole('link', {name: 'English'})).toHaveAttribute(
            'href',
            '/en/pricing?buy=team',
        )
    })
})
