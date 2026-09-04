import {cleanup, render, screen, waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {afterEach, describe, expect, it, vi} from 'vitest'

import TenantModulesPanel from '@/components/TenantModulesPanel'

const loadTenantModulesPanelData = vi.fn()
const activateTenantModule = vi.fn()
const deactivateTenantModule = vi.fn()
const applyTenantModulePreset = vi.fn()
const mockReplace = vi.fn()

vi.mock('next/navigation', () => ({
    useRouter: () => ({
        replace: mockReplace,
    }),
}))

vi.mock('@/lib/api/platformModulesApi', () => ({
    loadTenantModulesPanelData: (...args: unknown[]) => loadTenantModulesPanelData(...args),
    activateTenantModule: (...args: unknown[]) => activateTenantModule(...args),
    deactivateTenantModule: (...args: unknown[]) => deactivateTenantModule(...args),
    applyTenantModulePreset: (...args: unknown[]) => applyTenantModulePreset(...args),
}))

const mockModulesCatalog = [
    {
        moduleKey: 'CORE_AUTH',
        name: 'Core Auth',
        description: 'Authentication core module',
        dependsOn: [],
        core: true,
    },
    {
        moduleKey: 'PODCAST',
        name: 'Podcast Engine',
        description: 'Publish podcast episodes',
        dependsOn: ['CORE_AUTH'],
        core: false,
    },
    {
        moduleKey: 'PODCAST_RSS',
        name: 'Podcast RSS Feeds',
        description: 'Public & private RSS feeds',
        dependsOn: ['PODCAST'],
        core: false,
    },
]

describe('TenantModulesPanel', () => {
    afterEach(() => {
        cleanup()
        vi.clearAllMocks()
    })

    it('renders module list with active and inactive statuses', async () => {
        loadTenantModulesPanelData.mockResolvedValue({
            catalog: mockModulesCatalog,
            enabledModules: new Set(['CORE_AUTH', 'PODCAST']),
            activations: [],
        })

        render(<TenantModulesPanel tenantId="1" />)

        await waitFor(() => {
            expect(screen.getByText('Core Auth')).toBeInTheDocument()
            expect(screen.getByText('Podcast Engine')).toBeInTheDocument()
            expect(screen.getByText('Podcast RSS Feeds')).toBeInTheDocument()
        })

        expect(screen.getAllByText('Enabled')).toHaveLength(2)
        expect(screen.getByText('Off')).toBeInTheDocument()
    })

    it('activates an inactive module when clicking Activate', async () => {
        const user = userEvent.setup()
        loadTenantModulesPanelData.mockResolvedValue({
            catalog: mockModulesCatalog,
            enabledModules: new Set(['CORE_AUTH', 'PODCAST']),
            activations: [],
        })
        activateTenantModule.mockResolvedValue({
            enabledModules: ['CORE_AUTH', 'PODCAST', 'PODCAST_RSS'],
            activations: [],
        })

        render(<TenantModulesPanel tenantId="1" />)

        await waitFor(() => {
            expect(screen.getByRole('button', {name: 'Activate'})).toBeInTheDocument()
        })

        await user.click(screen.getByRole('button', {name: 'Activate'}))

        await waitFor(() => {
            expect(activateTenantModule).toHaveBeenCalledWith('1', 'PODCAST_RSS')
        })

        await waitFor(() => {
            expect(screen.getByRole('status')).toHaveTextContent('Activated PODCAST_RSS.')
            expect(screen.getAllByText('Enabled')).toHaveLength(3)
        })
    })

    it('deactivates an active non-core module when clicking Deactivate', async () => {
        const user = userEvent.setup()
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
        loadTenantModulesPanelData.mockResolvedValue({
            catalog: mockModulesCatalog,
            enabledModules: new Set(['CORE_AUTH', 'PODCAST']),
            activations: [],
        })
        deactivateTenantModule.mockResolvedValue({
            enabledModules: ['CORE_AUTH'],
            activations: [],
        })

        render(<TenantModulesPanel tenantId="1" />)

        await waitFor(() => {
            expect(screen.getAllByRole('button', {name: 'Deactivate'})).toHaveLength(2)
        })

        const buttons = screen.getAllByRole('button', {name: 'Deactivate'})
        const podcastDeactivateButton = buttons.find((btn) => !btn.hasAttribute('disabled'))
        expect(podcastDeactivateButton).toBeDefined()
        await user.click(podcastDeactivateButton!)

        await waitFor(() => {
            expect(deactivateTenantModule).toHaveBeenCalledWith('1', 'PODCAST')
        })

        await waitFor(() => {
            expect(screen.getByRole('status')).toHaveTextContent(
                'Deactivated PODCAST (and any dependents).',
            )
        })
        expect(confirmSpy).toHaveBeenCalled()
    })

    it('does not deactivate when the confirmation is dismissed', async () => {
        const user = userEvent.setup()
        vi.spyOn(window, 'confirm').mockReturnValue(false)
        loadTenantModulesPanelData.mockResolvedValue({
            catalog: mockModulesCatalog,
            enabledModules: new Set(['CORE_AUTH', 'PODCAST']),
            activations: [],
        })

        render(<TenantModulesPanel tenantId="1" />)

        await waitFor(() => {
            expect(screen.getAllByRole('button', {name: 'Deactivate'})).toHaveLength(2)
        })

        const buttons = screen.getAllByRole('button', {name: 'Deactivate'})
        const podcastDeactivateButton = buttons.find((btn) => !btn.hasAttribute('disabled'))
        expect(podcastDeactivateButton).toBeDefined()
        await user.click(podcastDeactivateButton!)

        expect(deactivateTenantModule).not.toHaveBeenCalled()
    })

    it('applies a module preset when clicking preset button', async () => {
        const user = userEvent.setup()
        loadTenantModulesPanelData.mockResolvedValue({
            catalog: mockModulesCatalog,
            enabledModules: new Set(['CORE_AUTH']),
            activations: [],
        })
        applyTenantModulePreset.mockResolvedValue({
            enabledModules: ['CORE_AUTH', 'PODCAST', 'PODCAST_RSS'],
            activations: [],
        })

        render(<TenantModulesPanel tenantId="1" />)

        await waitFor(() => {
            expect(screen.getByRole('button', {name: 'Free Podcast'})).toBeInTheDocument()
        })

        await user.click(screen.getByRole('button', {name: 'Free Podcast'}))

        await waitFor(() => {
            expect(applyTenantModulePreset).toHaveBeenCalledWith('1', 'FREE_PODCAST')
        })

        await waitFor(() => {
            expect(screen.getByRole('status')).toHaveTextContent('Applied preset FREE_PODCAST.')
        })
    })

    it('retries loading modules after a failure', async () => {
        const user = userEvent.setup()
        loadTenantModulesPanelData
            .mockRejectedValueOnce(new Error('unavailable'))
            .mockResolvedValue({
                catalog: mockModulesCatalog,
                enabledModules: new Set(['CORE_AUTH']),
                activations: [],
            })

        render(<TenantModulesPanel tenantId="1" />)

        expect(
            await screen.findByText('Could not load modules.')
        ).toBeInTheDocument()

        await user.click(screen.getByRole('button', {name: 'Retry'}))

        await waitFor(() => {
            expect(loadTenantModulesPanelData).toHaveBeenCalledTimes(2)
            expect(screen.getByText('Podcast Engine')).toBeInTheDocument()
        })
    })
})
