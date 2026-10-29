import {fireEvent, screen, waitFor} from '@testing-library/react'
import {renderWithLocale} from '@/lib/i18n/testUtils'
import {beforeEach, describe, expect, it, vi} from 'vitest'

import BrandingEditor from '@/components/settings/BrandingEditor'
import type {MediaAsset} from '@directwerk/api/types'

const mockRouter = {replace: vi.fn()}
vi.mock('next/link', () => ({
    default: ({children, href, ...props}: {children?: React.ReactNode; href: string; [key: string]: unknown}) => (
        <a href={href} {...props}>{children}</a>
    ),
}))

vi.mock('next/navigation', () => ({useRouter: () => mockRouter}))
vi.mock('@directwerk/api/auth/useAuthRequired', () => ({
    useAuthRequired: () => () => false,
}))
vi.mock('@directwerk/api/tenant', () => ({getClientTenantHost: () => 'tenant.test'}))

const getBranding = vi.fn()
const updateBranding = vi.fn()
const getContactEmail = vi.fn()
const updateContactEmail = vi.fn()
const siteConfig = {enabledModules: ['DIGITAL_CONTENT', 'PODCAST']}

const {readyLogo, uploadMediaFile} = vi.hoisted(() => {
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
    return {readyLogo: logo, uploadMediaFile: vi.fn()}
})

vi.mock('@/lib/api/tenantSettingsApi', () => ({
    getBranding: (...args: unknown[]) => getBranding(...args),
    updateBranding: (...args: unknown[]) => updateBranding(...args),
    getContactEmail: (...args: unknown[]) => getContactEmail(...args),
    updateContactEmail: (...args: unknown[]) => updateContactEmail(...args),
}))
vi.mock('@/lib/site/SiteConfigProvider', () => ({
    useSiteConfig: () => siteConfig,
}))
vi.mock('@/lib/media/upload', () => ({uploadMediaFile}))
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
    faviconUrl: null,
    umamiWebsiteId: 'abc12345',
    umamiHostUrl: 'https://umami.example.com',
}

describe('BrandingEditor color picker', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        siteConfig.enabledModules = ['DIGITAL_CONTENT', 'PODCAST', 'ANALYTICS']
        getBranding.mockResolvedValue(branding)
        getContactEmail.mockResolvedValue({contactEmail: 'podcast@show.example'})
        updateBranding.mockImplementation(
            async (input: Record<string, unknown>) => ({
                ...branding,
                ...input,
            }),
        )
        updateContactEmail.mockImplementation(
            async (input: {contactEmail: string}) => ({
                contactEmail: input.contactEmail,
            }),
        )
    })

    it('pairs each hex field with a native color picker showing the same color', async () => {
        renderWithLocale(<BrandingEditor />)

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
        renderWithLocale(<BrandingEditor />)
        await screen.findByLabelText('Primärfarbe')

        fireEvent.change(screen.getByLabelText('Sekundärfarbe Farbwähler'), {
            target: {value: '#ff0000'},
        })

        expect(screen.getByLabelText('Sekundärfarbe')).toHaveValue('#ff0000')
    })

    it('reflects a typed hex value in the color picker', async () => {
        renderWithLocale(<BrandingEditor />)
        const primaryField = await screen.findByLabelText('Primärfarbe')

        // NB: fireEvent instead of user.type — user-event's clear/type
        // keystrokes don't reach the Base-UI input primitive's state.
        fireEvent.change(primaryField, {target: {value: '#00ff00'}})

        expect(screen.getByLabelText('Primärfarbe Farbwähler')).toHaveValue(
            '#00ff00',
        )
    })

    it('rejects an invalid hex value with a German error and saves nothing', async () => {
        renderWithLocale(<BrandingEditor />)
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
        renderWithLocale(<BrandingEditor />)
        await screen.findByLabelText('Primärfarbe')

        fireEvent.change(screen.getByLabelText('Primärfarbe Farbwähler'), {
            target: {value: '#445566'},
        })
        // See above: fireEvent.submit carries live values in jsdom.
        fireEvent.submit(
            screen.getByLabelText('Primärfarbe').closest('form') as HTMLFormElement,
        )

        await waitFor(() =>
            expect(updateBranding).toHaveBeenCalledWith({
                siteTitle: 'Meine Sendung',
                primaryColor: '#445566',
                secondaryColor: null,
                logoUrl: null,
                faviconUrl: null,
                umamiWebsiteId: 'abc12345',
                umamiHostUrl: 'https://umami.example.com',
            }),
        )
        expect(updateContactEmail).toHaveBeenCalledWith({
            contactEmail: 'podcast@show.example',
        })
        await waitFor(() =>
            expect(screen.getByRole('status')).toHaveTextContent(
                'Branding gespeichert.',
            ),
        )
    })

    it('loads and saves the podcast contact email', async () => {
        getContactEmail.mockResolvedValue({contactEmail: 'owner@show.example'})
        renderWithLocale(<BrandingEditor />)

        const contactField = await screen.findByLabelText(/Kontakt-E-Mail/)
        expect(contactField).toHaveValue('owner@show.example')
        expect(contactField).toBeRequired()
        expect(
            screen.getByText(/Erscheint im Podcast-Feed als Owner-E-Mail/),
        ).toBeInTheDocument()

        fireEvent.change(contactField, {target: {value: 'new@show.example'}})
        fireEvent.submit(contactField.closest('form') as HTMLFormElement)

        await waitFor(() =>
            expect(updateContactEmail).toHaveBeenCalledWith({
                contactEmail: 'new@show.example',
            }),
        )
        expect(updateBranding).toHaveBeenCalled()
    })

    it('rejects clearing the podcast contact email', async () => {
        getContactEmail.mockResolvedValue({contactEmail: 'owner@show.example'})
        renderWithLocale(<BrandingEditor />)

        const contactField = await screen.findByLabelText(/Kontakt-E-Mail/)
        fireEvent.change(contactField, {target: {value: '   '}})
        fireEvent.submit(contactField.closest('form') as HTMLFormElement)

        await waitFor(() =>
            expect(screen.getByRole('alert')).toHaveTextContent(
                'Kontakt-E-Mail ist erforderlich.',
            ),
        )
        expect(updateBranding).not.toHaveBeenCalled()
        expect(updateContactEmail).not.toHaveBeenCalled()
    })

    it('rejects an invalid podcast contact email without saving', async () => {
        renderWithLocale(<BrandingEditor />)
        const contactField = await screen.findByLabelText(/Kontakt-E-Mail/)

        fireEvent.change(contactField, {target: {value: 'not-an-email'}})
        fireEvent.submit(contactField.closest('form') as HTMLFormElement)

        await waitFor(() =>
            expect(screen.getByRole('alert')).toHaveTextContent(
                'Bitte eine gültige Kontakt-E-Mail eingeben.',
            ),
        )
        expect(updateBranding).not.toHaveBeenCalled()
        expect(updateContactEmail).not.toHaveBeenCalled()
    })

    it('clears host override when website ID is cleared', async () => {
        renderWithLocale(<BrandingEditor />)
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
        renderWithLocale(<BrandingEditor />)
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

    it('ignores a host-only fill by clearing both Umami fields', async () => {
        getBranding.mockResolvedValue({...branding, umamiWebsiteId: null, umamiHostUrl: null})
        renderWithLocale(<BrandingEditor />)
        const serverField = await screen.findByLabelText('Umami-Server')
        fireEvent.change(serverField, {target: {value: 'https://cloud.umami.is'}})
        fireEvent.submit(serverField.closest('form') as HTMLFormElement)

        await waitFor(() =>
            expect(updateBranding).toHaveBeenCalledWith(
                expect.objectContaining({
                    umamiWebsiteId: '',
                    umamiHostUrl: '',
                }),
            ),
        )
    })

    it('allows clearing both Umami fields', async () => {
        renderWithLocale(<BrandingEditor />)
        const websiteField = await screen.findByLabelText('Umami Website-ID')
        const serverField = screen.getByLabelText('Umami-Server')

        expect(websiteField).not.toBeRequired()
        expect(serverField).not.toBeRequired()
        expect(
            screen.getByText(
                /Optionales Website-Tracking mit Umami/,
            ),
        ).toBeInTheDocument()

        fireEvent.change(websiteField, {target: {value: ''}})
        fireEvent.change(serverField, {target: {value: ''}})
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

    it('accepts a real Umami website UUID', async () => {
        renderWithLocale(<BrandingEditor />)
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

    it('accepts a Umami UUID with empty host (platform default)', async () => {
        getBranding.mockResolvedValue({
            ...branding,
            umamiWebsiteId: '12345678',
            umamiHostUrl: null,
        })
        renderWithLocale(<BrandingEditor />)
        const websiteField = await screen.findByLabelText('Umami Website-ID')
        fireEvent.change(websiteField, {
            target: {value: '16515bf8-1283-4a9a-9747-1b6ed4ab5b8a'},
        })
        fireEvent.submit(websiteField.closest('form') as HTMLFormElement)

        await waitFor(() =>
            expect(updateBranding).toHaveBeenCalledWith({
                siteTitle: 'Meine Sendung',
                primaryColor: '#112233',
                secondaryColor: null,
                logoUrl: null,
                faviconUrl: null,
                umamiWebsiteId: '16515bf8-1283-4a9a-9747-1b6ed4ab5b8a',
                umamiHostUrl: '',
            }),
        )
        expect(updateContactEmail).toHaveBeenCalledWith({
            contactEmail: 'podcast@show.example',
        })
    })

    it('accepts a Umami UUID with Umami Cloud host', async () => {
        getBranding.mockResolvedValue({
            ...branding,
            umamiWebsiteId: '12345678',
            umamiHostUrl: null,
        })
        renderWithLocale(<BrandingEditor />)
        const websiteField = await screen.findByLabelText('Umami Website-ID')
        const serverField = screen.getByLabelText('Umami-Server')
        fireEvent.change(websiteField, {
            target: {value: '16515bf8-1283-4a9a-9747-1b6ed4ab5b8a'},
        })
        fireEvent.change(serverField, {target: {value: 'https://cloud.umami.is'}})
        fireEvent.submit(websiteField.closest('form') as HTMLFormElement)

        await waitFor(() =>
            expect(updateBranding).toHaveBeenCalledWith(
                expect.objectContaining({
                    umamiWebsiteId: '16515bf8-1283-4a9a-9747-1b6ed4ab5b8a',
                    umamiHostUrl: 'https://cloud.umami.is',
                }),
            ),
        )
    })

    it('previews saved primary and draft secondary colors live', async () => {
        renderWithLocale(<BrandingEditor />)
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
        siteConfig.enabledModules = ['DIGITAL_CONTENT', 'PODCAST']
        renderWithLocale(<BrandingEditor />)
        await screen.findByLabelText(/Umami Website-ID/)

        expect(screen.getByRole('alert')).toHaveTextContent(
            'ANALYTICS-Modul ist für diesen Workspace nicht aktiv',
        )
    })

    it('stays quiet without a website ID even when the module is off', async () => {
        siteConfig.enabledModules = ['DIGITAL_CONTENT', 'PODCAST']
        getBranding.mockResolvedValue({...branding, umamiWebsiteId: null})
        renderWithLocale(<BrandingEditor />)
        await screen.findByLabelText(/Umami Website-ID/)

        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('stays quiet with a website ID when the ANALYTICS module is active', async () => {
        renderWithLocale(<BrandingEditor />)
        await screen.findByLabelText(/Umami Website-ID/)

        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('fills the logo URL from a media library image and submits it', async () => {
        renderWithLocale(<BrandingEditor />)
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
            expect(updateBranding).toHaveBeenCalledWith({
                siteTitle: 'Meine Sendung',
                primaryColor: '#112233',
                secondaryColor: null,
                logoUrl: readyLogo.cdnUrl,
                faviconUrl: null,
                umamiWebsiteId: 'abc12345',
                umamiHostUrl: 'https://umami.example.com',
            }),
        )
    })

    it('still accepts a manually typed logo URL', async () => {
        renderWithLocale(<BrandingEditor />)
        const logoField = await screen.findByLabelText('Oder Logo-URL')

        fireEvent.change(logoField, {
            target: {value: 'https://cdn.example.test/external-logo.png'},
        })
        fireEvent.submit(logoField.closest('form') as HTMLFormElement)

        await waitFor(() =>
            expect(updateBranding).toHaveBeenCalledWith({
                siteTitle: 'Meine Sendung',
                primaryColor: '#112233',
                secondaryColor: null,
                logoUrl: 'https://cdn.example.test/external-logo.png',
                faviconUrl: null,
                umamiWebsiteId: 'abc12345',
                umamiHostUrl: 'https://umami.example.com',
            }),
        )
    })

    it('fills the favicon URL from a media library image and submits it', async () => {
        renderWithLocale(<BrandingEditor />)
        const faviconField = await screen.findByLabelText('Oder Favicon-URL')
        expect(faviconField).toHaveValue('')

        fireEvent.click(
            screen.getByRole('button', {name: 'Favicon aus Mediathek'}),
        )

        expect(faviconField).toHaveValue(readyLogo.cdnUrl)
        expect(screen.getByAltText('Favicon-Vorschau')).toHaveAttribute(
            'src',
            readyLogo.cdnUrl!,
        )

        fireEvent.submit(faviconField.closest('form') as HTMLFormElement)

        await waitFor(() =>
            expect(updateBranding).toHaveBeenCalledWith({
                siteTitle: 'Meine Sendung',
                primaryColor: '#112233',
                secondaryColor: null,
                logoUrl: null,
                faviconUrl: readyLogo.cdnUrl,
                umamiWebsiteId: 'abc12345',
                umamiHostUrl: 'https://umami.example.com',
            }),
        )
    })

    it('locks favicon edits and saving while a favicon upload is in progress', async () => {
        getBranding.mockResolvedValue({
            ...branding,
            faviconUrl: 'https://cdn.example.test/favicon.ico',
        })
        let finishUpload: (asset: MediaAsset) => void = () => undefined
        uploadMediaFile.mockReturnValueOnce(
            new Promise<MediaAsset>((resolve) => {
                finishUpload = resolve
            }),
        )
        renderWithLocale(<BrandingEditor />)

        const faviconField = await screen.findByLabelText('Oder Favicon-URL')
        fireEvent.change(screen.getByLabelText('Favicon hochladen'), {
            target: {files: [new File(['icon'], 'favicon.png', {type: 'image/png'})]},
        })

        await waitFor(() => expect(faviconField).toBeDisabled())
        expect(screen.getByRole('button', {name: 'Favicon entfernen'})).toBeDisabled()
        expect(screen.getByRole('button', {name: 'Speichern'})).toBeDisabled()

        finishUpload(readyLogo)
        await waitFor(() => expect(faviconField).toBeEnabled())
    })
})
