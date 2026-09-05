'use client'

import {Button} from '@directwerk/ui/components/button'
import {useCopyToClipboard} from '@directwerk/ui/hooks/use-copy-to-clipboard'

/**
 * Displays source code in a styled, horizontally scrollable block with copy controls.
 *
 * @param code - The source code to display and copy
 * @param label - The label displayed above the code block
 * @returns The rendered code block
 */
export default function CodeBlock({
    code,
    label,
}: {
    code: string
    label?: string
}): React.JSX.Element {
    const {state, copy} = useCopyToClipboard()

    return (
        <div className="overflow-hidden rounded-xl border bg-muted/40">
            <div className="flex items-center justify-between gap-3 border-b px-4 py-2">
                <span className="text-xs font-medium text-muted-foreground">
                    {label ?? 'Beispiel'}
                </span>
                <Button onClick={() => void copy(code)} size="sm" variant="ghost">
                    {state === 'copied' ? 'Kopiert' : 'Kopieren'}
                </Button>
            </div>
            <pre className="overflow-x-auto p-4 font-mono text-xs leading-6 text-foreground">
                <code>{code}</code>
            </pre>
        </div>
    )
}
