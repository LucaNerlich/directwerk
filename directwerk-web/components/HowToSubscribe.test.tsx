import {cleanup, render, screen} from '@testing-library/react'
import {afterEach, describe, expect, it} from 'vitest'

import HowToSubscribe from '@/components/HowToSubscribe'
import HowToListen from '@/components/HowToListen'
import HowToRead from '@/components/HowToRead'

afterEach(cleanup)

describe('HowToSubscribe', () => {
    it('renders podcast-only instructions like the legacy HowToListen', () => {
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

    it('keeps the legacy wrappers working for feeds/account consumers', () => {
        const {unmount} = render(
            <HowToListen publicFeedUrl="https://tenant.example/feed.xml" isAuthenticated />,
        )
        expect(
            screen.getByRole('heading', {name: 'So hörst du in der Podcast-App'}),
        ).toBeInTheDocument()
        unmount()

        render(<HowToRead publicFeedUrl="https://tenant.example/articles.xml" />)
        expect(
            screen.getByRole('heading', {name: 'So liest du im Feed-Reader'}),
        ).toBeInTheDocument()
    })
})
