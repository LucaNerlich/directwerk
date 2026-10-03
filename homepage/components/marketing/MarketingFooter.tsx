'use client'

import {useLocale} from '@/components/i18n/LocaleProvider'
import {CONTACT_EMAIL, DOCS_URL} from '@/lib/marketing/constants'
import {hrefFor} from '@/lib/i18n/pathname'

export default function MarketingFooter(): React.JSX.Element {
    const year = new Date().getFullYear()
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
                        return (
                            <a
                                className="text-muted-foreground transition-colors hover:text-foreground"
                                href={href}
                                key={`${item.href}-${item.label}`}
                                {...(external
                                    ? {rel: 'noopener noreferrer', target: '_blank'}
                                    : {})}
                            >
                                {item.label}
                            </a>
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
                {copy.copyright.replace('{year}', String(year))}
            </div>
        </footer>
    )
}
