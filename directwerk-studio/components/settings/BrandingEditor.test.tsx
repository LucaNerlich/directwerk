import {fireEvent, render, screen, waitFor} from '@testing-library/react'
import {beforeEach, describe, expect, it, vi} from 'vitest'

import BrandingEditor from '@/components/settings/BrandingEditor'
import type {MediaAsset} from '@directwerk/api/types'

const mockRouter = {replace: vi.fn()}
vi.mock('next/navigation', () => ({useRouter: () => mockRouter}))
vi.mock('@directwerk/api/auth/useAuthRequired', () => ({
    useAuthRequired: () => () => false,
}))
vi.mock('@directwerk/api/tenant', () => ({getClientTenantHost: () => 'tenant.test'}))

const getBranding = vi.fn()
const updateBranding = vi.fn()
const siteConfig = {enabledModules: ['DIGITAL_CONTENT', 'PODCAST']}

const {readyLogo} = vi.hoisted(() => {
    const logo: MediaAsset = {
        id: 42,
        s3Key: 't/public/images/logo.png',
        visibility: 'PUBLIC',
        scope: 'LIBRARY',
        assetType: 'IMAGE',
        status: 'READY',
        mimeType: 'image/png',
        sizeBytes: 1024,
        originalFilename: 'logo.png',
        episodeId: null,
        ownerUserId: null,
        folderId: null,
        createdBy: null,
        cdnUrl: 'https://cdn.example.test/t/public/images/logo.png',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
    }
    return {readyLogo: logo}
})

vi.mock('@/lib/api/tenantSettingsApi', () => ({
    getBranding: (...args: unknown[]) => getBranding(...args),
    updateBranding: (...args: unknown[]) => updateBranding(...args),
}))
vi.mock('@/lib/site/SiteConfigProvider', () => ({
    useSiteConfig: () => siteConfig,
}))
vi.mock('@/components/media/MediaLibraryPicker', () => ({
    default: ({
        label,
        onSelect,
        disabled,
    }: {
        label: string
        onSelect: (asset: MediaAsset) => void
        disabled?: boolean
    }) => (
        <button
            disabled={disabled}
            onClick={() => onSelect(readyLogo)}
            type="button"
        >
            {label}
        </button>
    ),
}))

const branding = {
    siteTitle: 'Meine Sendung',
    primaryColor: '#112233',
    secondaryColor: null,
    logoUrl: null,
    umamiWebsiteId: null,
    umamiHostUrl: null,
}

describe('BrandingEditor color picker', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        siteConfig.enabledModules = ['DIGITAL_CONTENT', 'PODCAST']
        getBranding.mockResolvedValue(branding)
        updateBranding.mockImplementation(
            async (_host: unknown, input: Record<string, unknown>) => ({
                ...branding,
                ...input,
            }),
        )
    })

    it('pairs each hex field with a native color picker showing the same color', async () => {
        render(<BrandingEditor />)

        const primaryField = await screen.findByLabelText('Primärfarbe')
        expect(primaryField).toHaveValue('#112233')
        expect(primaryField).toHaveAttribute('type', 'text')

        const primaryPicker = screen.getByLabelText('Primärfarbe Farbwähler')
        expect(primaryPicker).toHaveAttribute('type', 'color')
        expect(primaryPicker).toHaveValue('#112233')

        // Empty draft falls back to black without touching the hex field.
        expect(screen.getByLabelText('Sekundärfarbe')).toHaveValue('')
        expect(screen.getByLabelText('Sekundärfarbe Farbwähler')).toHaveValue(
            '#000000',
        )
    })

    it('writes a picked color into the hex field', async () => {
        render(<BrandingEditor />)
        await screen.findByLabelText('Primärfarbe')

        fireEvent.change(screen.getByLabelText('Sekundärfarbe Farbwähler'), {
            target: {value: '#ff0000'},
        })

        expect(screen.getByLabelText('Sekundärfarbe')).toHaveValue('#ff0000')
    })

    it('reflects a typed hex value in the color picker', async () => {
        render(<BrandingEditor />)
        const primaryField = await screen.findByLabelText('Primärfarbe')

        // NB: fireEvent instead of user.type — user-event's clear/type
        // keystrokes don't reach the Base-UI input primitive's state.
        fireEvent.change(primaryField, {target: {value: '#00ff00'}})

        expect(screen.getByLabelText('Primärfarbe Farbwähler')).toHaveValue(
            '#00ff00',
        )
    })

    it('rejects an invalid hex value with a German error and saves nothing', async () => {
        render(<BrandingEditor />)
        const primaryField = await screen.findByLabelText('Primärfarbe')

        fireEvent.change(primaryField, {target: {value: 'rot'}})
        // NB: fireEvent.submit instead of clicking Speichern — jsdom's
        // implicit submission delivers a stale FormData snapshot for
        // controlled inputs, while real browsers submit live values
        // (next/form passes function actions through to a plain <form>).
        fireEvent.submit(primaryField.closest('form') as HTMLFormElement)

        await waitFor(() =>
            expect(screen.getByRole('alert')).toHaveTextContent(
                'Primärfarbe muss #RRGGBB sein.',
            ),
        )
        expect(updateBranding).not.toHaveBeenCalled()
    })

    it('submits the picked color as valid 6-digit hex', async () => {
        render(<BrandingEditor />)
        await screen.findByLabelText('Primärfarbe')

        fireEvent.change(screen.getByLabelText('Primärfarbe Farbwähler'), {
            target: {value: '#445566'},
        })
        // See above: fireEvent.submit carries live values in jsdom.
        fireEvent.submit(
            screen.getByLabelText('Primärfarbe').closest('form') as HTMLFormElement,
        )

        await waitFor(() =>
            expect(updateBranding).toHaveBeenCalledWith('tenant.test', {
                siteTitle: 'Meine Sendung',
                primaryColor: '#445566',
                secondaryColor: null,
                logoUrl: null,
                umamiWebsiteId: null,
                umamiHostUrl: null,
            }),
        )
        await waitFor(() =>
            expect(screen.getByRole('status')).toHaveTextContent(
                'Branding gespeichert.',
            ),
        )
    })

    it('previews saved primary and draft secondary colors live', async () => {
        render(<BrandingEditor />)
        await screen.findByLabelText('Primärfarbe')

        const previewButton = screen.getByRole('button', {name: 'Sekundär'})
        const previewScope = previewButton.closest('div[style]')
        expect(previewScope).toHaveStyle({'--primary': '#112233'})

        fireEvent.change(screen.getByLabelText('Sekundärfarbe'), {
            target: {value: '#ff0000'},
        })
        expect(previewButton.closest('div[style]')).toHaveStyle({
            '--secondary': '#ff0000',
        })
    })

    it('warns when a website ID is set but the ANALYTICS module is off', async () => {
        getBranding.mockResolvedValue({...branding, umamiWebsiteId: 'abc12345'})
        render(<BrandingEditor />)
        await screen.findByLabelText('Umami Website-ID')

        expect(screen.getByRole('alert')).toHaveTextContent(
            'ANALYTICS-Modul ist für diesen Workspace nicht aktiv',
        )
    })

    it('stays quiet without a website ID even when the module is off', async () => {
        render(<BrandingEditor />)
        await screen.findByLabelText('Umami Website-ID')

        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('stays quiet with a website ID when the ANALYTICS module is active', async () => {
        siteConfig.enabledModules = ['DIGITAL_CONTENT', 'PODCAST', 'ANALYTICS']
        getBranding.mockResolvedValue({...branding, umamiWebsiteId: 'abc12345'})
        render(<BrandingEditor />)
        await screen.findByLabelText('Umami Website-ID')

        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('fills the logo URL from a media library image and submits it', async () => {
        render(<BrandingEditor />)
        const logoField = await screen.findByLabelText('Oder Logo-URL')
        expect(logoField).toHaveValue('')

        fireEvent.click(screen.getByRole('button', {name: 'Logo aus Mediathek'}))

        expect(logoField).toHaveValue(readyLogo.cdnUrl)
        expect(screen.getByAltText('Logo-Vorschau')).toHaveAttribute(
            'src',
            readyLogo.cdnUrl!,
        )

        fireEvent.submit(logoField.closest('form') as HTMLFormElement)

        await waitFor(() =>
            expect(updateBranding).toHaveBeenCalledWith('tenant.test', {
                siteTitle: 'Meine Sendung',
                primaryColor: '#112233',
                secondaryColor: null,
                logoUrl: readyLogo.cdnUrl,
                umamiWebsiteId: null,
                umamiHostUrl: null,
            }),
        )
    })

    it('still accepts a manually typed logo URL', async () => {
        render(<BrandingEditor />)
        const logoField = await screen.findByLabelText('Oder Logo-URL')

        fireEvent.change(logoField, {
            target: {value: 'https://cdn.example.test/external-logo.png'},
        })
        fireEvent.submit(logoField.closest('form') as HTMLFormElement)

        await waitFor(() =>
            expect(updateBranding).toHaveBeenCalledWith('tenant.test', {
                siteTitle: 'Meine Sendung',
                primaryColor: '#112233',
                secondaryColor: null,
                logoUrl: 'https://cdn.example.test/external-logo.png',
                umamiWebsiteId: null,
                umamiHostUrl: null,
            }),
        )
    })
})
