import {cleanup, render, screen} from '@testing-library/react'
import {afterEach, describe, expect, it} from 'vitest'

import HowToRead from '@/components/HowToRead'

afterEach(cleanup)

describe('HowToRead', () => {
    it('shows accessible public and private article feeds', () => {
        render(
            <HowToRead
                publicFeedUrl="https://tenant.example/feeds/tenant/articles.xml"
                privateFeedUrl="https://tenant.example/feeds/tenant/articles/u/token.xml"
            />,
        )

        expect(
            screen.getByRole('heading', {name: 'So liest du im Feed-Reader'}),
        ).toBeInTheDocument()
        expect(screen.getByText('Öffentlicher Beitrags-Feed')).toBeInTheDocument()
        expect(screen.getByText('Dein privater Beitrags-Feed')).toBeInTheDocument()
        expect(
            screen.getByRole('link', {
                name: 'Öffnen — Öffentlicher Beitrags-Feed',
            }),
        ).toHaveAttribute(
            'href',
            'https://tenant.example/feeds/tenant/articles.xml',
        )
        expect(
            screen.getByRole('link', {
                name: 'Öffnen — Dein privater Beitrags-Feed',
            }),
        ).toHaveAttribute(
            'href',
            'https://tenant.example/feeds/tenant/articles/u/token.xml',
        )
        expect(
            screen.getByRole('button', {
                name: 'Kopieren — Öffentlicher Beitrags-Feed',
            }),
        ).toBeInTheDocument()
        expect(
            screen.getByRole('button', {
                name: 'Kopieren — Dein privater Beitrags-Feed',
            }),
        ).toBeInTheDocument()
        expect(screen.getByRole('link', {name: 'Feeds verwalten'})).toHaveAttribute(
            'href',
            '/feeds',
        )
    })
})
