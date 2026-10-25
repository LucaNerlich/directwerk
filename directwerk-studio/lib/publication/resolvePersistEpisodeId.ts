/**
 * Prefer the route id, then a deferred-create id kept while still on /new, then
 * the in-memory episode — so a failed attach after create cannot mint a second row.
 */
export function resolvePersistEpisodeId(
    routeId: number | undefined,
    deferredCreateId: number | undefined,
    episodeId: number | undefined,
): number | undefined {
    return routeId ?? deferredCreateId ?? episodeId
}
