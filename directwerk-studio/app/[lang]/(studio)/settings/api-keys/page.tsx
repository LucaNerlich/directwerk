import ApiKeysClient from '@/components/settings/ApiKeysClient'
import {resolveMcpUrl} from '@/lib/settings/mcpUrl'

export default function ApiKeysSettingsPage(): React.JSX.Element {
    return <ApiKeysClient mcpUrl={resolveMcpUrl()} />
}
