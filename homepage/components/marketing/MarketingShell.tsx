import MarketingFooter from '@/components/marketing/MarketingFooter'
import MarketingHeader from '@/components/marketing/MarketingHeader'

export default function MarketingShell({
    children,
}: {
    children: React.ReactNode
}): React.JSX.Element {
    return (
        <div className="min-h-screen bg-background">
            <a
                className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
                href="#main-content"
            >
                Zum Inhalt springen
            </a>
            <MarketingHeader />
            <main id="main-content" tabIndex={-1}>
                {children}
            </main>
            <MarketingFooter />
        </div>
    )
}
