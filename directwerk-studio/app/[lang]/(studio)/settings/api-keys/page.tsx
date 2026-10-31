import ApiKeysClient from '@/components/settings/ApiKeysClient'

function resolveMcpUrl(): string {
    const raw = process.env.DIRECTWERK_API_URL?.trim() || 'https://api.example.com'
    const base = raw.replace(/\/$/, '')
    return `${base}/mcp`
}

export default function ApiKeysSettingsPage(): React.JSX.Element {
    return <ApiKeysClient mcpUrl={resolveMcpUrl()} />
}
