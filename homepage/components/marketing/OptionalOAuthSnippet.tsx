'use client'

import {useState} from 'react'

import {Button} from '@directwerk/ui/components/button'

import CodeBlock from '@/components/marketing/CodeBlock'
import {OAUTH_TOKEN_CURL} from '@/lib/api-docs/snippets'

export default function OptionalOAuthSnippet(): React.JSX.Element {
    const [open, setOpen] = useState(false)

    return (
        <div className="space-y-3">
            <Button
                aria-expanded={open}
                onClick={() => setOpen((value) => !value)}
                variant="outline"
            >
                {open ? 'OAuth-Beispiel ausblenden' : 'OAuth-Token-Beispiel anzeigen'}
            </Button>
            {open ? (
                <CodeBlock code={OAUTH_TOKEN_CURL} label="POST /oauth2/token" />
            ) : null}
        </div>
    )
}
