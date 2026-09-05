import {cleanup, render, screen} from '@testing-library/react'
import {afterEach, describe, expect, it} from 'vitest'

import HowToSubscribe from '@/components/HowToSubscribe'

afterEach(cleanup)

describe('HowToSubscribe', () => {
    it('renders podcast-only instructions', () => {
        render(
            <HowToSubscribe
                podcast={{publicFeedUrl: 'https://tenant.example/feed.xml'}}
                isAuthenticated={false}
            />,
        )

        expect(
            screen.getByRole('heading', {name: 'So hörst du in der Podcast-App'}),
        ).toBeInTheDocument()
        expect(screen.getByText('Öffentlicher Feed')).toBeInTheDocument()
        expect(
            screen.queryByRole('heading', {name: 'So liest du im Feed-Reader'}),
        ).not.toBeInTheDocument()
    })

    it('renders article instructions where previously missing', () => {
        render(
            <HowToSubscribe
                articles={{publicFeedUrl: 'https://tenant.example/articles.xml'}}
                isAuthenticated={false}
            />,
        )

        expect(
            screen.getByRole('heading', {name: 'So liest du im Feed-Reader'}),
        ).toBeInTheDocument()
        expect(screen.getByText('Öffentlicher Beitrags-Feed')).toBeInTheDocument()
        expect(
            screen.queryByRole('heading', {name: 'So hörst du in der Podcast-App'}),
        ).not.toBeInTheDocument()
    })

    it('renders both blocks together', () => {
        render(
            <HowToSubscribe
                podcast={{publicFeedUrl: 'https://tenant.example/feed.xml'}}
                articles={{publicFeedUrl: 'https://tenant.example/articles.xml'}}
                isAuthenticated
            />,
        )

        expect(
            screen.getByRole('heading', {name: 'So hörst du in der Podcast-App'}),
        ).toBeInTheDocument()
        expect(
            screen.getByRole('heading', {name: 'So liest du im Feed-Reader'}),
        ).toBeInTheDocument()
    })

    it('renders nothing without any feed pair', () => {
        const {container} = render(<HowToSubscribe isAuthenticated={false} />)
        expect(container).toBeEmptyDOMElement()
    })

    it('renders the podcast block from a podcast feed pair', () => {
        render(
            <HowToSubscribe
                podcast={{publicFeedUrl: 'https://tenant.example/feed.xml'}}
                isAuthenticated
            />,
        )
        expect(
            screen.getByRole('heading', {name: 'So hörst du in der Podcast-App'}),
        ).toBeInTheDocument()
    })

    it('renders the articles block from an articles feed pair', () => {
        render(
            <HowToSubscribe
                articles={{publicFeedUrl: 'https://tenant.example/articles.xml'}}
                isAuthenticated={false}
            />,
        )
        expect(
            screen.getByRole('heading', {name: 'So liest du im Feed-Reader'}),
        ).toBeInTheDocument()
    })

    it('hides private feed token URLs from guests for both kinds', () => {
        const {container} = render(
            <HowToSubscribe
                podcast={{
                    publicFeedUrl: 'https://tenant.example/feed.xml',
                    privateFeedUrl: 'https://tenant.example/feed/u/podcast-token.xml',
                }}
                articles={{
                    publicFeedUrl: 'https://tenant.example/articles.xml',
                    privateFeedUrl:
                        'https://tenant.example/articles/u/article-token.xml',
                }}
                isAuthenticated={false}
            />,
        )

        expect(container.innerHTML).not.toContain('podcast-token.xml')
        expect(container.innerHTML).not.toContain('article-token.xml')
    })

    it('shows private article feed URLs when authenticated', () => {
        render(
            <HowToSubscribe
                articles={{
                    publicFeedUrl: 'https://tenant.example/articles.xml',
                    privateFeedUrl:
                        'https://tenant.example/articles/u/article-token.xml',
                }}
                isAuthenticated
            />,
        )

        expect(screen.getByText('Dein privater Beitrags-Feed')).toBeInTheDocument()
    })
})
