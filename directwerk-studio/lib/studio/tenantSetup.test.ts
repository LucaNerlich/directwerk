import {describe, expect, it} from 'vitest'

import de from '@/dictionaries/de.json'
import {
    buildTenantSetupSteps,
    evaluateTenantSetupSignals,
    isTenantSetupComplete,
} from '@/lib/studio/tenantSetup'
import type {SiteConfig} from '@directwerk/api/types'

function config(overrides: Partial<SiteConfig> = {}): SiteConfig {
    return {
        tenant: {slug: 'tenant', name: 'Tenant'},
        enabledModules: ['PODCAST', 'STRIPE_BILLING', 'EMAIL_NOTIFY'],
        branding: {
            siteTitle: null,
            primaryColor: null,
            secondaryColor: null,
            logoUrl: null,
            faviconUrl: null,
        },
        publicSiteUrl: 'https://example.com',
        publicRssUrl: null,
        publicArticleRssUrl: null,
        studioHome: 'PODCAST_DESK',
        studioDesks: ['PODCAST'],
        analytics: null,
        emailNotifyAvailable: true,
        ...overrides,
    }
}

describe('tenantSetup', () => {
    it('marks branding ready when a visual signal is set', () => {
        const signals = evaluateTenantSetupSignals({
            config: config({
                branding: {
                    siteTitle: 'My Show',
                    primaryColor: null,
                    secondaryColor: null,
                    logoUrl: null,
                    faviconUrl: null,
                },
            }),
            domains: [{host: 'example.com', primary: true, verified: true}],
            hasPublishedContent: true,
            integrations: null,
        })
        expect(signals.brandingReady).toBe(true)
        expect(signals.domainVerified).toBe(true)
    })

    it('gates stripe and mailgun steps on modules', () => {
        const steps = buildTenantSetupSteps(
            evaluateTenantSetupSignals({
                config: config({enabledModules: ['PODCAST']}),
                domains: [],
                hasPublishedContent: false,
                integrations: null,
            }),
            de,
            config({enabledModules: ['PODCAST']}),
        )
        expect(steps.some((step) => step.id === 'stripe')).toBe(false)
        expect(steps.some((step) => step.id === 'mailgun')).toBe(false)
    })

    it('treats setup complete when required steps are done', () => {
        const cfg = config({
            branding: {
                siteTitle: 'Show',
                primaryColor: '#112233',
                secondaryColor: null,
                logoUrl: null,
                faviconUrl: null,
            },
        })
        const steps = buildTenantSetupSteps(
            evaluateTenantSetupSignals({
                config: cfg,
                domains: [{host: 'example.com', primary: true, verified: true}],
                hasPublishedContent: true,
                integrations: {
                    emailNotify: {
                        moduleEnabled: true,
                        platformSenderReady: true,
                        platformProvider: null,
                        customTemplateCount: 0,
                        mailgun: {
                            provider: 'MAILGUN',
                            status: 'CONNECTED',
                            domain: 'mg.example.com',
                            region: 'EU',
                            fromEmail: 'a@b.c',
                            fromName: null,
                            connectedAt: null,
                            apiKeyConfigured: true,
                        },
                    },
                    analytics: {moduleEnabled: false},
                    stripe: {
                        moduleEnabled: true,
                        status: 'CONNECTED',
                        chargesEnabled: true,
                        payoutsEnabled: true,
                        detailsSubmitted: true,
                        message: '',
                    },
                },
            }),
            de,
            cfg,
        )
        expect(isTenantSetupComplete(steps)).toBe(true)
    })
})
