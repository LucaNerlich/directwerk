'use client'

import Link from 'next/link'

import {useLocale} from '@/components/i18n/LocaleProvider'
import {CONTACT_EMAIL, DOCS_URL} from '@/lib/marketing/constants'
import {hrefFor} from '@/lib/i18n/pathname'

export default function MarketingFooter(): React.JSX.Element {
    // Issue #447: the year was computed at build time in a statically prerendered client
    // component, so '© {year}' went stale until the next rebuild. The dictionary copy now omits
    // the year entirely rather than shipping a frozen one.
    const {lang, dictionary} = useLocale()
    const copy = dictionary.footer

    return (
        <footer className="border-t bg-muted/30">
            <div className="marketing-container flex flex-col gap-8 py-12 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <p className="text-lg font-semibold tracking-tight">Directwerk</p>
                    <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                        {copy.blurb}
                    </p>
                </div>
                <nav
                    aria-label={copy.navAria}
                    className="flex flex-col gap-2 text-sm"
                >
                    {copy.navItems.map((item) => {
                        const external = 'external' in item && item.external
                        const href =
                            item.href === 'docs'
                                ? DOCS_URL
                                : external
                                  ? item.href
                                  : hrefFor(lang, item.href)
                        const className =
                            'text-muted-foreground transition-colors hover:text-foreground'
                        const key = `${item.href}-${item.label}`
                        // Issue #444: internal footer links used <a>, forcing a full reload and
                        // re-downloading the RSC payload; the header already uses next/link.
                        if (external || item.href === 'docs') {
                            return (
                                <a
                                    className={className}
                                    href={href}
                                    key={key}
                                    rel="noopener noreferrer"
                                    target="_blank"
                                >
                                    {item.label}
                                </a>
                            )
                        }
                        return (
                            <Link className={className} href={href} key={key}>
                                {item.label}
                            </Link>
                        )
                    })}
                    <a
                        className="text-muted-foreground transition-colors hover:text-foreground"
                        href={`mailto:${CONTACT_EMAIL}`}
                    >
                        {copy.contact}
                    </a>
                </nav>
            </div>
            <div className="marketing-container border-t py-6 text-xs text-muted-foreground">
                {copy.copyright}
            </div>
        </footer>
    )
}
