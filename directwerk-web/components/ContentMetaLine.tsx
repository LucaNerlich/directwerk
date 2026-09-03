import type {ReactNode} from 'react'

export default function ContentMetaLine({
    items,
}: {
    items: Array<ReactNode | null | undefined | false>
}): React.JSX.Element | null {
    const visible = items.filter(
        (item): item is ReactNode => item !== null && item !== undefined && item !== false,
    )
    if (visible.length === 0) {
        return null
    }

    return (
        <p className="mt-1 text-sm text-muted-foreground">
            {visible.map((item, index) => (
                <span key={index}>
                    {index > 0 ? ' · ' : null}
                    {item}
                </span>
            ))}
        </p>
    )
}
