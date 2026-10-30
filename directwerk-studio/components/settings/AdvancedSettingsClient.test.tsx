import {fireEvent, screen, waitFor} from '@testing-library/react'
import {beforeEach, describe, expect, it, vi} from 'vitest'

import AdvancedSettingsClient from '@/components/settings/AdvancedSettingsClient'
import {renderWithLocale} from '@/lib/i18n/testUtils'

vi.mock('next/link', () => ({
    default: ({children, href, ...props}: {children?: React.ReactNode; href: string; [key: string]: unknown}) => (
        <a href={href} {...props}>{children}</a>
    ),
}))

vi.mock('@directwerk/api/auth/useAuthRequired', () => ({
    useAuthRequired: () => () => false,
}))

const getBranding = vi.fn()
const updateBranding = vi.fn()
const siteConfig = {enabledModules: ['DIGITAL_CONTENT', 'PODCAST', 'ANALYTICS']}

vi.mock('@/lib/api/tenantSettingsApi', () => ({
    getBranding: (...args: unknown[]) => getBranding(...args),
    updateBranding: (...args: unknown[]) => updateBranding(...args),
}))
vi.mock('@/lib/site/SiteConfigProvider', () => ({
    useSiteConfig: () => siteConfig,
}))

const branding = {
    siteTitle: 'Meine Sendung',
    primaryColor: '#112233',
    secondaryColor: null,
    logoUrl: null,
    faviconUrl: null,
    umamiWebsiteId: 'abc12345',
    umamiHostUrl: 'https://umami.example.com',
}

describe('AdvancedSettingsClient', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        siteConfig.enabledModules = ['DIGITAL_CONTENT', 'PODCAST', 'ANALYTICS']
        getBranding.mockResolvedValue(branding)
        updateBranding.mockImplementation(async (input: Record<string, unknown>) => ({
            ...branding,
            ...input,
        }))
    })

    it('clears host override when website ID is cleared', async () => {
        renderWithLocale(<AdvancedSettingsClient />)
        const websiteField = await screen.findByLabelText('Umami Website-ID')
        fireEvent.change(websiteField, {target: {value: '   '}})
        fireEvent.submit(websiteField.closest('form') as HTMLFormElement)

        await waitFor(() =>
            expect(updateBranding).toHaveBeenCalledWith(
                expect.objectContaining({
                    umamiWebsiteId: '',
                    umamiHostUrl: '',
                }),
            ),
        )
    })

    it('allows clearing only the Umami server (platform default host)', async () => {
        renderWithLocale(<AdvancedSettingsClient />)
        const serverField = await screen.findByLabelText('Umami-Server')
        fireEvent.change(serverField, {target: {value: '   '}})
        fireEvent.submit(serverField.closest('form') as HTMLFormElement)

        await waitFor(() =>
            expect(updateBranding).toHaveBeenCalledWith(
                expect.objectContaining({
                    umamiWebsiteId: 'abc12345',
                    umamiHostUrl: '',
                }),
            ),
        )
    })

    it('accepts a real Umami website UUID', async () => {
        renderWithLocale(<AdvancedSettingsClient />)
        const websiteField = await screen.findByLabelText('Umami Website-ID')
        fireEvent.change(websiteField, {
            target: {value: '16515bf8-1283-4a9a-9747-1b6ed4ab5b8a'},
        })
        fireEvent.submit(websiteField.closest('form') as HTMLFormElement)

        await waitFor(() =>
            expect(updateBranding).toHaveBeenCalledWith(
                expect.objectContaining({
                    umamiWebsiteId: '16515bf8-1283-4a9a-9747-1b6ed4ab5b8a',
                    umamiHostUrl: 'https://umami.example.com',
                }),
            ),
        )
    })

    it('warns when a website ID is set but the ANALYTICS module is off', async () => {
        siteConfig.enabledModules = ['DIGITAL_CONTENT', 'PODCAST']
        renderWithLocale(<AdvancedSettingsClient />)
        await screen.findByLabelText(/Umami Website-ID/)

        expect(screen.getByRole('alert')).toHaveTextContent(
            'ANALYTICS-Modul ist für diesen Workspace nicht aktiv',
        )
    })
})
