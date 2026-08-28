import {render, screen} from '@testing-library/react'
import {describe, expect, it} from 'vitest'

import StatCard from './stat-card'

describe('StatCard', () => {
    it('renders label, value, and hint', () => {
        render(<StatCard hint="3 active" label="Tenants" value={12} />)

        expect(screen.getByText('Tenants')).toBeInTheDocument()
        expect(screen.getByText('12')).toBeInTheDocument()
        expect(screen.getByText('3 active')).toBeInTheDocument()
    })
})
