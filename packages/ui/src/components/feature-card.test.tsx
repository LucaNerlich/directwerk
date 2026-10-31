import {cleanup, render, screen} from '@testing-library/react'
import {afterEach, describe, expect, it} from 'vitest'

import FeatureCard from './feature-card'

afterEach(cleanup)

describe('FeatureCard', () => {
    it('stacks copy and children when media is omitted', () => {
        const {container} = render(
            <FeatureCard description="Teaser" eyebrow="Newest" title="Featured">
                <button type="button">Read</button>
            </FeatureCard>,
        )

        const panel = container.querySelector('[data-dw-surface="panel"]')
        expect(panel?.className).toContain('flex')
        expect(panel?.className).not.toContain('sm:grid-cols-[minmax(0,1fr)_auto]')
        expect(screen.getByText('Newest')).toBeInTheDocument()
        expect(screen.getByRole('heading', {name: 'Featured'})).toBeInTheDocument()
        expect(screen.getByRole('button', {name: 'Read'})).toBeInTheDocument()
    })

    it('uses a horizontal copy | media grid when media is provided', () => {
        const {container} = render(
            <FeatureCard
                eyebrow="Newest"
                media={<img alt="Cover" src="https://cdn.example/cover.jpg" />}
                title="Featured"
            >
                <button type="button">Listen</button>
            </FeatureCard>,
        )

        const panel = container.querySelector('[data-dw-surface="panel"]')
        expect(panel?.className).toContain('sm:grid-cols-[minmax(0,1fr)_auto]')
        expect(screen.getByRole('img', {name: 'Cover'})).toBeInTheDocument()
        expect(screen.getByRole('button', {name: 'Listen'})).toBeInTheDocument()
    })
})
