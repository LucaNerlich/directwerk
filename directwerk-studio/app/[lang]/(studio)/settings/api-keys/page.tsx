import ApiKeysClient from '@/components/settings/ApiKeysClient'

function resolveMcpUrl(): string {
    // Never the server-side upstream base: on the documented deployment that is an internal
    // Docker hostname external MCP clients cannot reach (and it leaks into the page payload).
    // Server-only read: never the internal upstream base (#1049). Unset renders an empty
    // endpoint instead of a reserved placeholder domain, and the copy block says what to set.
    const raw = process.env.NEXT_PUBLIC_API_URL?.trim()
    if (!raw) {
        return ''
    }
    const base = raw.replace(/\/$/, '')
    return `${base}/mcp`
}

export default function ApiKeysSettingsPage(): React.JSX.Element {
    return <ApiKeysClient mcpUrl={resolveMcpUrl()} />
}
