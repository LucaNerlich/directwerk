'use client'

import {Button} from '@directwerk/ui/components/button'
import {useCopyToClipboard} from '@directwerk/ui/hooks/use-copy-to-clipboard'

export default function CodeBlock({
    code,
    label,
    copyLabel,
    copiedLabel,
}: {
    code: string
    label?: string
    /** Issue #349: the button labels were hardcoded German and rendered on /en too. */
    copyLabel: string
    copiedLabel: string
}): React.JSX.Element {
    const {state, copy} = useCopyToClipboard()

    return (
        <div className="overflow-hidden rounded-xl border bg-muted/40">
            <div className="flex items-center justify-between gap-3 border-b px-4 py-2">
                <span className="text-xs font-medium text-muted-foreground">
                    {label}
                </span>
                <Button onClick={() => void copy(code)} size="sm" variant="ghost">
                    {state === 'copied' ? copiedLabel : copyLabel}
                </Button>
            </div>
            <pre className="overflow-x-auto p-4 font-mono text-xs leading-6 text-foreground">
                <code>{code}</code>
            </pre>
        </div>
    )
}
