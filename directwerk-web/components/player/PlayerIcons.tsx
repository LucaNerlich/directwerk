/** Inline player glyphs — avoids pulling lucide into the web package. */

export function PlayGlyph({className}: {className?: string}): React.JSX.Element {
    return (
        <svg
            aria-hidden="true"
            className={className}
            fill="currentColor"
            viewBox="0 0 24 24"
        >
            <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86a1 1 0 0 0-1.5.86Z" />
        </svg>
    )
}

export function PauseGlyph({className}: {className?: string}): React.JSX.Element {
    return (
        <svg
            aria-hidden="true"
            className={className}
            fill="currentColor"
            viewBox="0 0 24 24"
        >
            <path d="M7 5a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1H7Zm7 0a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-3Z" />
        </svg>
    )
}

export function CloseGlyph({className}: {className?: string}): React.JSX.Element {
    return (
        <svg
            aria-hidden="true"
            className={className}
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
        >
            <path d="M6 6l12 12M18 6L6 18" />
        </svg>
    )
}
