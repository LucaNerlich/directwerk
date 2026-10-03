'use client'

import {Button} from '@directwerk/ui/components/button'
import {useCopyToClipboard} from '@directwerk/ui/hooks/use-copy-to-clipboard'

import {useDictionary} from '@/lib/i18n/LocaleProvider'

export default function CopyUrlButton({
    url,
    className,
    size = 'sm',
    context,
}: {
    url: string
    className?: string
    size?: 'default' | 'sm' | 'lg' | 'icon'
    context?: string
}): React.JSX.Element {
    const {state, copy} = useCopyToClipboard()
    const {common} = useDictionary()

    return (
        <span className="inline-flex flex-col gap-1">
            <Button
                aria-label={
                    context === undefined
                        ? undefined
                        : `${state === 'copied' ? common.copied : common.copy} — ${context}`
                }
                className={className}
                onClick={() => {
                    void copy(url)
                }}
                size={size}
                type="button"
                variant="outline"
            >
                {state === 'copied' ? common.copiedExclaim : common.copy}
            </Button>
            <span aria-live="polite" role="status" className="sr-only">
                {state === 'copied' ? common.copySuccessSr : null}
            </span>
            {state === 'failed' ? (
                <span className="max-w-55 text-xs leading-5 text-muted-foreground" role="status">
                    {common.copyFailed}
                </span>
            ) : null}
        </span>
    )
}
