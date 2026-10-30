import {hasDesk, hasModule} from '@/lib/api/client'
import type {Dictionary} from '@/lib/i18n/dictionary'
import type {SetupStep} from '@/lib/studio/setupStep'
import type {IntegrationsStatus, SiteConfig, TenantDomain} from '@directwerk/api/types'

export interface TenantSetupSignals {
    brandingReady: boolean
    domainVerified: boolean
    hasPublishedContent: boolean
    stripeReady: boolean | null
    mailgunReady: boolean | null
    publicSiteUrl: string | null
}

export function evaluateTenantSetupSignals(input: {
    config: SiteConfig
    domains: TenantDomain[] | null
    hasPublishedContent: boolean
    integrations: IntegrationsStatus | null
}): TenantSetupSignals {
    const {config, domains, hasPublishedContent, integrations} = input
    const branding = config.branding
    const brandingReady =
        (branding.siteTitle !== null && branding.siteTitle.trim().length > 0) ||
        branding.primaryColor !== null ||
        branding.logoUrl !== null

    const domainVerified = domains !== null && domains.some((domain) => domain.verified)

    const stripeReady = hasModule(config, 'STRIPE_BILLING')
        ? integrations?.stripe.status === 'CONNECTED'
        : null

    const mailgunReady = hasModule(config, 'EMAIL_NOTIFY')
        ? integrations?.emailNotify.mailgun?.status === 'CONNECTED'
        : null

    return {
        brandingReady,
        domainVerified,
        hasPublishedContent,
        stripeReady,
        mailgunReady,
        publicSiteUrl: config.publicSiteUrl,
    }
}

export function buildTenantSetupSteps(
    signals: TenantSetupSignals,
    dict: Dictionary,
    config: SiteConfig,
): SetupStep[] {
    const copy = dict.shell.home.setup
    const contentHref = hasDesk(config, 'WRITE')
        ? '/write'
        : hasDesk(config, 'PODCAST')
          ? '/podcast'
          : '/'
    const steps: SetupStep[] = [
        {
            id: 'branding',
            title: copy.brandingTitle,
            description: copy.brandingDescription,
            done: signals.brandingReady,
            href: '/settings/branding',
            actionLabel: signals.brandingReady ? copy.reviewAction : copy.brandingAction,
            primary: !signals.brandingReady,
        },
        {
            id: 'domain',
            title: copy.domainTitle,
            description: copy.domainDescription,
            done: signals.domainVerified,
            href: '/settings/domains',
            actionLabel: signals.domainVerified ? copy.reviewAction : copy.domainAction,
            primary: signals.brandingReady && !signals.domainVerified,
        },
        {
            id: 'content',
            title: copy.contentTitle,
            description: copy.contentDescription,
            done: signals.hasPublishedContent,
            href: contentHref,
            actionLabel: signals.hasPublishedContent ? copy.reviewAction : copy.contentAction,
            primary:
                signals.brandingReady &&
                signals.domainVerified &&
                !signals.hasPublishedContent,
        },
    ]

    if (signals.stripeReady !== null) {
        steps.push({
            id: 'stripe',
            title: copy.stripeTitle,
            description: copy.stripeDescription,
            done: signals.stripeReady,
            href: '/settings/stripe',
            actionLabel: signals.stripeReady ? copy.reviewAction : copy.stripeAction,
        })
    }

    if (signals.mailgunReady !== null) {
        steps.push({
            id: 'mailgun',
            title: copy.mailgunTitle,
            description: copy.mailgunDescription,
            done: signals.mailgunReady,
            href: '/settings/integrations',
            actionLabel: signals.mailgunReady ? copy.reviewAction : copy.mailgunAction,
        })
    }

    if (signals.publicSiteUrl !== null && signals.publicSiteUrl.length > 0) {
        steps.push({
            id: 'public-site',
            title: copy.publicSiteTitle,
            description: copy.publicSiteDescription,
            done: signals.brandingReady && signals.domainVerified && signals.hasPublishedContent,
            href: signals.publicSiteUrl,
            actionLabel: copy.publicSiteAction,
            external: true,
        })
    }

    return steps
}

export function isTenantSetupComplete(steps: SetupStep[]): boolean {
    return steps
        .filter((step) => step.id !== 'public-site')
        .every((step) => step.done)
}
