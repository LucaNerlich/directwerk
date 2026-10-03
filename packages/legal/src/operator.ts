/**
 * Platform operator details — the single place to edit (§ 5 DDG, Art. 13 DSGVO).
 *
 * Sourced from https://lucanerlich.com/imprint (and its GitHub source
 * `src/pages/imprint.md`) as of 2026-10-03. Only fields published there are
 * filled in; everything else stays `null` with a TODO so we never invent
 * contact or company data.
 *
 * All five surfaces (directwerk-web, directwerk-studio, directwerk-admin,
 * homepage, directwerk-docs) render from here.
 *
 * Tenant apps currently show this platform imprint as the alpha default.
 * Tenant-customizable legal texts (via site-config) are a follow-up.
 */
export type OperatorDetails = {
    name: string
    email: string
    /** TODO: postal street missing on lucanerlich.com/imprint */
    street: string | null
    /** TODO: postal city / ZIP missing on lucanerlich.com/imprint */
    city: string | null
    /**
     * Inferred from the German § 5 TMG/DDG imprint on the source page
     * (jurisdiction), not an explicit line item there.
     */
    country: string | null
    /** TODO: phone missing on lucanerlich.com/imprint */
    phone: string | null
    /** TODO: commercial register court missing (natural person on source) */
    registerCourt: string | null
    /** TODO: commercial register number missing (natural person on source) */
    registerNumber: string | null
    /** TODO: VAT ID (§ 27a UStG) missing on lucanerlich.com/imprint */
    vatId: string | null
    /** Name from source; full MStV address still TODO (no postal address published) */
    responsiblePerson: string | null
}

export const OPERATOR: OperatorDetails = {
    name: 'Luca Nerlich',
    email: 'luca.nerlich@gmail.com',
    street: null,
    city: null,
    country: 'Deutschland',
    phone: null,
    registerCourt: null,
    registerNumber: null,
    vatId: null,
    responsiblePerson: 'Luca Nerlich',
}

/** Comma-separated provider line from known fields only (no placeholders). */
export function formatOperatorProviderLine(): string {
    return [OPERATOR.name, OPERATOR.street, OPERATOR.city, OPERATOR.country]
        .filter((part): part is string => typeof part === 'string' && part.length > 0)
        .join(', ')
}

/** Controller / contact line for privacy (name, optional address, email). */
export function formatOperatorControllerLine(): string {
    const location = [OPERATOR.street, OPERATOR.city, OPERATOR.country]
        .filter((part): part is string => typeof part === 'string' && part.length > 0)
        .join(', ')
    if (location.length > 0) {
        return `${OPERATOR.name}, ${location}, E-Mail: ${OPERATOR.email}`
    }
    return `${OPERATOR.name}, E-Mail: ${OPERATOR.email}`
}
