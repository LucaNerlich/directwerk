import {CONTACT_EMAIL, NAV_ITEMS} from '@/lib/marketing/constants'

export default function MarketingFooter(): React.JSX.Element {
    const year = new Date().getFullYear()

    return (
        <footer className="border-t bg-muted/30">
            <div className="marketing-container flex flex-col gap-8 py-12 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <p className="text-lg font-semibold tracking-tight">Directwerk</p>
                    <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                        Multi-Tenant-Whitelabel-Backend für Podcast, Abonnements und
                        digitales Publishing — mit Studio, API und optionaler
                        Endkunden-Website.
                    </p>
                </div>
                <nav
                    aria-label="Footer"
                    className="flex flex-col gap-2 text-sm"
                >
                    {NAV_ITEMS.map((item) => (
                        <a
                            className="text-muted-foreground transition-colors hover:text-foreground"
                            href={item.href}
                            key={item.href}
                        >
                            {item.label}
                        </a>
                    ))}
                    <a
                        className="text-muted-foreground transition-colors hover:text-foreground"
                        href={`mailto:${CONTACT_EMAIL}`}
                    >
                        Kontakt
                    </a>
                </nav>
            </div>
            <div className="marketing-container border-t py-6 text-xs text-muted-foreground">
                © {year} Directwerk · API-first Publishing-Infrastruktur
            </div>
        </footer>
    )
}
