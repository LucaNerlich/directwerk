export default function SectionLabel({
    children,
}: {
    children: React.ReactNode
}): React.JSX.Element {
    return (
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            {children}
        </p>
    )
}
