import type {ApiHighlight} from '@/lib/api-docs/highlights'

const METHOD_STYLES: Record<ApiHighlight['method'], string> = {
    GET: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300',
    POST: 'bg-blue-500/15 text-blue-800 dark:text-blue-300',
    PUT: 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
    DELETE: 'bg-red-500/15 text-red-800 dark:text-red-300',
}

export default function ApiHighlightTable({
    highlights,
}: {
    highlights: readonly ApiHighlight[]
}): React.JSX.Element {
    return (
        <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[36rem] text-left text-sm">
                <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                        <th className="px-4 py-3 font-semibold" scope="col">
                            Methode
                        </th>
                        <th className="px-4 py-3 font-semibold" scope="col">
                            Pfad
                        </th>
                        <th className="hidden px-4 py-3 font-semibold sm:table-cell" scope="col">
                            Beschreibung
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {highlights.map((row) => (
                        <tr className="align-top" key={`${row.method}-${row.path}`}>
                            <td className="px-4 py-3">
                                <span
                                    className={`inline-flex rounded-md px-2 py-0.5 font-mono text-xs font-semibold ${METHOD_STYLES[row.method]}`}
                                >
                                    {row.method}
                                </span>
                            </td>
                            <td className="px-4 py-3 font-mono text-xs leading-5">
                                {row.path}
                                <p className="mt-1 text-sm leading-6 text-muted-foreground sm:hidden">
                                    {row.description}
                                </p>
                            </td>
                            <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                                {row.description}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
