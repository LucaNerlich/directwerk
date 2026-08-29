import type {ReactNode} from 'react'

export default function ContentMetaLine({
    items,
}: {
    items: Array<ReactNode | null | undefined | false>
}): React.JSX.Element {
    const visible = items.filter(
        (item): item is ReactNode => item !== null && item !== undefined && item !== false,
    )

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
