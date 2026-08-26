import {cleanup, render, screen} from '@testing-library/react'
import type {ComponentProps, ReactNode} from 'react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import DeskSwitcher from '@/components/studio/DeskSwitcher'
import type {SiteConfig} from '@directwerk/api/types'

let currentPathname = '/'

vi.mock('next/navigation', () => ({
    usePathname: () => currentPathname,
}))
vi.mock('next/link', () => ({
    default: ({
        'aria-current': ariaCurrent,
        children,
        href,
        className,
    }: {
        'aria-current'?: ComponentProps<'a'>['aria-current']
        children: ReactNode
        href: string
        className?: string
    }) => (
        <a aria-current={ariaCurrent} className={className} href={href}>
            {children}
        </a>
    ),
}))

beforeEach(() => {
    currentPathname = '/'
})

afterEach(cleanup)

function config(overrides: Partial<SiteConfig> = {}): SiteConfig {
    return {
        tenant: {slug: 'tenant', name: 'Tenant'},
        enabledModules: ['DIGITAL_CONTENT', 'PODCAST'],
        branding: {siteTitle: null, primaryColor: null, secondaryColor: null, logoUrl: null},
        publicRssUrl: 'http://localhost:8080/feeds/tenant/podcast.xml',
        studioHome: 'OVERVIEW',
        studioDesks: ['WRITE', 'PODCAST'],
        emailNotifyAvailable: false,
        ...overrides,
    }
}

describe('DeskSwitcher', () => {
    it('renders Write and Podcast links for hybrid tenants', () => {
        render(<DeskSwitcher config={config()} />)

        const writeLink = screen.getByRole('link', {name: 'Schreiben'})
        const podcastLink = screen.getByRole('link', {name: 'Podcast'})

        expect(writeLink).toHaveAttribute('href', '/write/articles')
        expect(podcastLink).toHaveAttribute('href', '/podcast')
    })

    it('marks Write desk active when pathname is under /write/*', () => {
        currentPathname = '/write/articles'
        render(<DeskSwitcher config={config()} />)

        expect(screen.getByRole('link', {name: 'Schreiben'})).toHaveAttribute(
            'aria-current',
            'page',
        )
        expect(screen.getByRole('link', {name: 'Podcast'})).not.toHaveAttribute('aria-current')
    })

    it('marks Podcast desk active when pathname is under /podcast/*', () => {
        currentPathname = '/podcast/episodes'
        render(<DeskSwitcher config={config()} />)

        expect(screen.getByRole('link', {name: 'Podcast'})).toHaveAttribute(
            'aria-current',
            'page',
        )
        expect(screen.getByRole('link', {name: 'Schreiben'})).not.toHaveAttribute('aria-current')
    })

    it('does not mark either desk active on shared routes', () => {
        currentPathname = '/'
        render(<DeskSwitcher config={config()} />)

        expect(screen.getByRole('link', {name: 'Schreiben'})).not.toHaveAttribute('aria-current')
        expect(screen.getByRole('link', {name: 'Podcast'})).not.toHaveAttribute('aria-current')
    })

    it('does not render for single-desk WRITE tenants', () => {
        const {container} = render(<DeskSwitcher config={config({studioDesks: ['WRITE']})} />)
        expect(container).toBeEmptyDOMElement()
    })

    it('does not render for single-desk PODCAST tenants', () => {
        const {container} = render(<DeskSwitcher config={config({studioDesks: ['PODCAST']})} />)
        expect(container).toBeEmptyDOMElement()
    })

    it('does not render when studioDesks is empty', () => {
        const {container} = render(<DeskSwitcher config={config({studioDesks: []})} />)
        expect(container).toBeEmptyDOMElement()
    })
})
