import {cleanup, render, screen, waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {afterEach, describe, expect, it, vi} from 'vitest'

import TenantModulesPanel from '@/components/TenantModulesPanel'

const getPlatformData = vi.fn()
const postPlatformData = vi.fn()
const deletePlatformData = vi.fn()
const mockReplace = vi.fn()

vi.mock('next/navigation', () => ({
    useRouter: () => ({
        replace: mockReplace,
    }),
}))

vi.mock('@/lib/api/client', () => ({
    getPlatformData: (...args: unknown[]) => getPlatformData(...args),
    postPlatformData: (...args: unknown[]) => postPlatformData(...args),
    deletePlatformData: (...args: unknown[]) => deletePlatformData(...args),
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
        getPlatformData.mockImplementation((path: string) => {
            if (path === 'modules') {
                return Promise.resolve(mockModulesCatalog)
            }
            if (path === 'tenants/1/modules') {
                return Promise.resolve({enabledModules: ['CORE_AUTH', 'PODCAST']})
            }
            return Promise.reject(new Error('Unknown path'))
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
        getPlatformData.mockImplementation((path: string) => {
            if (path === 'modules') {
                return Promise.resolve(mockModulesCatalog)
            }
            if (path === 'tenants/1/modules') {
                return Promise.resolve({enabledModules: ['CORE_AUTH', 'PODCAST']})
            }
            return Promise.reject(new Error('Unknown path'))
        })
        postPlatformData.mockResolvedValue({
            enabledModules: ['CORE_AUTH', 'PODCAST', 'PODCAST_RSS'],
        })

        render(<TenantModulesPanel tenantId="1" />)

        await waitFor(() => {
            expect(screen.getByRole('button', {name: 'Activate'})).toBeInTheDocument()
        })

        await user.click(screen.getByRole('button', {name: 'Activate'}))

        await waitFor(() => {
            expect(postPlatformData).toHaveBeenCalledWith(
                'tenants/1/modules/PODCAST_RSS/activate',
                {}
            )
        })

        await waitFor(() => {
            expect(screen.getByRole('status')).toHaveTextContent('Activated PODCAST_RSS.')
            expect(screen.getAllByText('Enabled')).toHaveLength(3)
        })
    })

    it('deactivates an active non-core module when clicking Deactivate', async () => {
        const user = userEvent.setup()
        getPlatformData.mockImplementation((path: string) => {
            if (path === 'modules') {
                return Promise.resolve(mockModulesCatalog)
            }
            if (path === 'tenants/1/modules') {
                return Promise.resolve({enabledModules: ['CORE_AUTH', 'PODCAST']})
            }
            return Promise.reject(new Error('Unknown path'))
        })
        deletePlatformData.mockResolvedValue({
            enabledModules: ['CORE_AUTH'],
        })

        render(<TenantModulesPanel tenantId="1" />)

        await waitFor(() => {
            expect(screen.getAllByRole('button', {name: 'Deactivate'})).toHaveLength(2)
        })

        // Click the non-core module's Deactivate button (the enabled one)
        const buttons = screen.getAllByRole('button', {name: 'Deactivate'})
        const podcastDeactivateButton = buttons.find((btn) => !btn.hasAttribute('disabled'))
        expect(podcastDeactivateButton).toBeDefined()
        await user.click(podcastDeactivateButton!)

        await waitFor(() => {
            expect(deletePlatformData).toHaveBeenCalledWith('tenants/1/modules/PODCAST')
        })

        await waitFor(() => {
            expect(screen.getByRole('status')).toHaveTextContent(
                'Deactivated PODCAST (and any dependents).'
            )
        })
    })

    it('applies a module preset when clicking preset button', async () => {
        const user = userEvent.setup()
        getPlatformData.mockImplementation((path: string) => {
            if (path === 'modules') {
                return Promise.resolve(mockModulesCatalog)
            }
            if (path === 'tenants/1/modules') {
                return Promise.resolve({enabledModules: ['CORE_AUTH']})
            }
            return Promise.reject(new Error('Unknown path'))
        })
        postPlatformData.mockResolvedValue({
            enabledModules: ['CORE_AUTH', 'PODCAST', 'PODCAST_RSS'],
        })

        render(<TenantModulesPanel tenantId="1" />)

        await waitFor(() => {
            expect(screen.getByRole('button', {name: 'Free Podcast'})).toBeInTheDocument()
        })

        await user.click(screen.getByRole('button', {name: 'Free Podcast'}))

        await waitFor(() => {
            expect(postPlatformData).toHaveBeenCalledWith(
                'tenants/1/modules/preset/FREE_PODCAST',
                {}
            )
        })

        await waitFor(() => {
            expect(screen.getByRole('status')).toHaveTextContent('Applied preset FREE_PODCAST.')
        })
    })
})
