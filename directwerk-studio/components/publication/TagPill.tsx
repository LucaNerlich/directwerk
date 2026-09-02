import {Badge} from '@directwerk/ui/components/badge'

export default function TagPill({name}: {name: string}): React.JSX.Element {
    return <Badge variant="outline">{name}</Badge>
}
