import {cleanup, render, screen, waitFor} from '@testing-library/react'
import {afterEach, describe, expect, it, vi} from 'vitest'

const listPublicNewsletterListsMock = vi.fn()

vi.mock('@/lib/api/publicApi', () => ({
    listPublicNewsletterLists: (...args: unknown[]) =>
        listPublicNewsletterListsMock(...args),
}))

import NewsletterIndexClient from '@/components/newsletter/NewsletterIndexClient'
import {TestLocale} from '@/lib/i18n/testWrapper'
import {SiteConfigProvider} from '@/lib/site/SiteConfigProvider'

const siteConfig = {
    tenant: {slug: 'alpha', name: 'Alpha Show'},
    enabledModules: ['NEWSLETTER'],
    branding: {
        siteTitle: 'Alpha Show',
        primaryColor: null,
        secondaryColor: null,
        logoUrl: null,
        faviconUrl: null,
    },
    publicRssUrl: null,
    publicArticleRssUrl: null,
    publicSiteUrl: null,
    analytics: null,
    emailNotifyAvailable: true,
}

afterEach(() => {
    cleanup()
    listPublicNewsletterListsMock.mockReset()
})

describe('newsletter index error copy (#555)', () => {
    it('shows localized copy instead of raw upstream text', async () => {
        // The proxy answers a JSON error body; its message is backend/transport text and must
        // never reach an anonymous visitor.
        listPublicNewsletterListsMock.mockRejectedValue(
            Object.assign(new Error('The upstream service returned an invalid response.'), {
                status: 502,
            }),
        )

        render(
            <TestLocale>
                <SiteConfigProvider config={siteConfig}>
                    <NewsletterIndexClient initialLists={null} />
                </SiteConfigProvider>
            </TestLocale>,
        )

        await waitFor(() =>
            expect(screen.getByText('Listen konnten nicht geladen werden.')).toBeTruthy(),
        )
        expect(
            screen.queryByText('The upstream service returned an invalid response.'),
        ).toBeNull()
    })
})
