import {cleanup, render, screen} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import AdminSideNav from '@/components/AdminSideNav'

let pathname = '/'

vi.mock('next/navigation', () => ({
    usePathname: () => pathname,
}))

vi.mock('next/link', () => ({
    default: ({
        children,
        href,
        ...props
    }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {href: string}) => (
        <a href={href} {...props}>
            {children}
        </a>
    ),
}))

beforeEach(() => {
    pathname = '/'
})

afterEach(cleanup)

describe('AdminSideNav', () => {
    it('exposes the platform destinations as accessible links', () => {
        render(<AdminSideNav />)

        expect(screen.getByRole('navigation', {name: 'Main navigation'})).toBeInTheDocument()
        expect(screen.getByRole('link', {name: 'Overview'})).toHaveAttribute('href', '/')
        expect(screen.getByRole('link', {name: 'Tenants'})).toHaveAttribute('href', '/tenants')
        expect(screen.getByRole('link', {name: 'Platform admins'})).toHaveAttribute(
            'href',
            '/admins',
        )
        expect(screen.getByRole('link', {name: 'Audit log'})).toHaveAttribute(
            'href',
            '/audit',
        )
        expect(screen.getByRole('link', {name: 'Jobs'})).toHaveAttribute('href', '/jobs')
    })

    it('marks only the matching navigation branch as current', () => {
        pathname = '/jobs/42'

        render(<AdminSideNav />)

        expect(screen.getByRole('link', {name: 'Jobs'})).toHaveAttribute(
            'aria-current',
            'page',
        )
        expect(screen.getByRole('link', {name: 'Overview'})).not.toHaveAttribute(
            'aria-current',
        )
    })
})
