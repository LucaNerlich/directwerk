import type {TenantSubscriber} from '@directwerk/api/types'

function csvEscape(value: string): string {
    if (/[",\n\r]/.test(value)) {
        return `"${value.replaceAll('"', '""')}"`
    }
    return value
}

/**
 * Builds a GDPR-aware subscriber export: one row per product grant (or a single
 * row with empty product columns when the subscriber has none).
 */
export function buildSubscriberCsv(subscribers: TenantSubscriber[]): string {
    const header = [
        'email',
        'name',
        'account_status',
        'product_title',
        'product_slug',
        'subscription_status',
        'source',
        'started_at',
        'ends_at',
        'external_subscription_id',
    ]
    const lines = [header.join(',')]
    for (const subscriber of subscribers) {
        const name = subscriber.name ?? ''
        if (subscriber.subscriptions.length === 0) {
            lines.push(
                [
                    csvEscape(subscriber.email),
                    csvEscape(name),
                    csvEscape(subscriber.status),
                    '',
                    '',
                    '',
                    '',
                    '',
                    '',
                    '',
                ].join(','),
            )
            continue
        }
        for (const item of subscriber.subscriptions) {
            lines.push(
                [
                    csvEscape(subscriber.email),
                    csvEscape(name),
                    csvEscape(subscriber.status),
                    csvEscape(item.productTitle),
                    csvEscape(item.productSlug),
                    csvEscape(item.status),
                    csvEscape(item.source),
                    csvEscape(item.startedAt ?? ''),
                    csvEscape(item.endsAt ?? ''),
                    csvEscape(item.externalSubscriptionId ?? ''),
                ].join(','),
            )
        }
    }
    return `${lines.join('\n')}\n`
}

export function downloadSubscriberCsv(csv: string, filename: string): void {
    const blob = new Blob([csv], {type: 'text/csv;charset=utf-8'})
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()
    URL.revokeObjectURL(url)
}
