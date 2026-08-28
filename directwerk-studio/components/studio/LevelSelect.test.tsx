import {render, screen, waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {beforeEach, describe, expect, it, vi} from 'vitest'

import LevelSelect from '@/components/studio/LevelSelect'

const {host, listPublicLevels} = vi.hoisted(() => ({
    host: {value: 'tenant-0.test'},
    listPublicLevels: vi.fn(),
}))

vi.mock('@/lib/tenant/getClientTenantHost', () => ({
    getClientTenantHost: () => host.value,
}))
vi.mock('@/lib/api/subscriptionApi', () => ({
    listPublicLevels: (...args: unknown[]) => listPublicLevels(...args),
}))

const LEVELS = [
    {id: 1, slug: 'fan', title: 'Fan', sortOrder: 10},
    {id: 2, slug: 'supporter', title: 'Supporter', sortOrder: 20},
]

let counter = 0

beforeEach(() => {
    counter += 1
    host.value = `tenant-${counter}.test`
    listPublicLevels.mockReset()
})

describe('LevelSelect', () => {
    it('renders the public option and level options after loading', async () => {
        listPublicLevels.mockResolvedValue(LEVELS)
        render(<LevelSelect value={null} onChange={vi.fn()} />)

        expect(
            await screen.findByRole('option', {name: 'Öffentlich / Keine Mindeststufe'}),
        ).toBeInTheDocument()
        expect(screen.getByRole('option', {name: 'Fan (10)'})).toBeInTheDocument()
        expect(screen.getByRole('option', {name: 'Supporter (20)'})).toBeInTheDocument()
    })

    it('reports null when the public option is selected', async () => {
        listPublicLevels.mockResolvedValue(LEVELS)
        const onChange = vi.fn()
        const user = userEvent.setup()
        render(<LevelSelect value={10} onChange={onChange} />)

        const trigger = await screen.findByRole('combobox')
        await user.selectOptions(trigger, '')

        expect(onChange).toHaveBeenCalledWith(null)
    })

    it('reports the sortOrder when a level is selected', async () => {
        listPublicLevels.mockResolvedValue(LEVELS)
        const onChange = vi.fn()
        const user = userEvent.setup()
        render(<LevelSelect value={null} onChange={onChange} />)

        const trigger = await screen.findByRole('combobox')
        await user.selectOptions(trigger, '10')

        expect(onChange).toHaveBeenCalledWith(10)
    })

    it('is disabled while levels are loading', async () => {
        let resolveLevels!: (value: typeof LEVELS) => void
        listPublicLevels.mockImplementation(
            () =>
                new Promise((resolve) => {
                    resolveLevels = resolve
                }),
        )
        render(<LevelSelect value={null} onChange={vi.fn()} />)

        const trigger = screen.getByRole('combobox')
        expect(trigger).toBeDisabled()

        resolveLevels(LEVELS)
        await waitFor(() => expect(trigger).toBeEnabled())
    })

    it('stays disabled when the disabled prop is set', async () => {
        listPublicLevels.mockResolvedValue(LEVELS)
        render(<LevelSelect value={null} onChange={vi.fn()} disabled />)

        const trigger = await screen.findByRole('combobox')
        await waitFor(() => expect(trigger).toBeDisabled())
    })

    it('surfaces a value that is missing from the level list', async () => {
        listPublicLevels.mockResolvedValue(LEVELS)
        render(<LevelSelect value={99} onChange={vi.fn()} />)

        expect(await screen.findByRole('option', {name: 'Stufe 99'})).toBeInTheDocument()
    })

    it('stays disabled when loading fails', async () => {
        listPublicLevels.mockRejectedValue(new Error('boom'))
        render(<LevelSelect value={null} onChange={vi.fn()} />)

        const trigger = screen.getByRole('combobox')
        await waitFor(() => expect(trigger).toBeDisabled())
    })
})
