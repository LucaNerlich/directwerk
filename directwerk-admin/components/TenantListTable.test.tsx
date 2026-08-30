import {cleanup, fireEvent, render, screen} from '@testing-library/react'
import {afterEach, describe, expect, it} from 'vitest'

import TenantListTable from '@/components/TenantListTable'
import type {Tenant} from '@directwerk/api/types'

const tenants: Tenant[] = [
    {
        id: 1,
        name: 'Alpha Audio',
        slug: 'alpha',
        status: 'ACTIVE',
        primaryDomain: 'alpha.test',
        createdAt: '2026-08-01T00:00:00Z',
    },
    {
        id: 2,
        name: 'Beta Media',
        slug: 'beta',
        status: 'SUSPENDED',
        primaryDomain: null,
        createdAt: '2026-08-02T00:00:00Z',
    },
]

afterEach(cleanup)

describe('TenantListTable', () => {
    it('renders labelled entity links with English view controls', () => {
        render(<TenantListTable tenants={tenants} />)

        expect(screen.getByRole('list', {name: 'Tenants'})).toBeInTheDocument()
        expect(screen.getByRole('link', {name: 'Alpha Audio'})).toHaveAttribute(
            'href',
            '/tenants/1',
        )
        expect(screen.getByRole('button', {name: 'List'})).toBeInTheDocument()
        expect(screen.getByRole('button', {name: 'Grid'})).toBeInTheDocument()
    })

    it('filters tenants and shows an explicit no-match state', () => {
        render(<TenantListTable tenants={tenants} />)

        fireEvent.change(screen.getByRole('searchbox', {name: 'Search'}), {
            target: {value: 'alpha.test'},
        })
        expect(screen.getByText('Alpha Audio')).toBeInTheDocument()
        expect(screen.queryByText('Beta Media')).not.toBeInTheDocument()

        fireEvent.change(screen.getByLabelText('Status'), {
            target: {value: 'SUSPENDED'},
        })
        expect(
            screen.getByText('No tenants match your filters.'),
        ).toBeInTheDocument()
        expect(screen.queryByRole('list', {name: 'Tenants'})).not.toBeInTheDocument()
    })
})
