'use client'

import {useState} from 'react'

import {Button} from '@directwerk/ui/components/button'

export default function CopyUrlButton({
    url,
    className,
    size = 'sm',
}: {
    url: string
    className?: string
    size?: 'default' | 'sm' | 'lg' | 'icon'
}): React.JSX.Element {
    const [copied, setCopied] = useState(false)

    async function handleCopy(): Promise<void> {
        try {
            await navigator.clipboard.writeText(url)
            setCopied(true)
            window.setTimeout(() => setCopied(false), 2000)
        } catch {
            setCopied(false)
        }
    }

    return (
        <Button
            className={className}
            onClick={() => {
                void handleCopy()
            }}
            size={size}
            type="button"
            variant="outline"
        >
            {copied ? 'Kopiert!' : 'Kopieren'}
        </Button>
    )
}
