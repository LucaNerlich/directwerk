import type {MetadataRoute} from 'next'

/**
 * Issue #446: a localized marketing site had no robots.txt or sitemap — crawlers got no crawl
 * policy and no hreflang hints for a brand-new domain whose main goal is organic discovery.
 */
export default function robots(): MetadataRoute.Robots {
    return {
        rules: [{userAgent: '*', allow: '/'}],
        sitemap: 'https://directwerk.org/sitemap.xml',
    }
}
