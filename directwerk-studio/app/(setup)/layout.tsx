import BrandTheme from '@directwerk/ui/components/brand-theme'

export default function SetupLayout({
    children,
}: {
    children: React.ReactNode
}): React.JSX.Element {
    return (
        <BrandTheme primaryHex="#1a1a2e">
            <div className="min-h-screen bg-background">{children}</div>
        </BrandTheme>
    )
}
