/**
 * Platform operator details — the single place to edit (§ 5 DDG, Art. 13 DSGVO).
 *
 * **TODO before publishing:** replace every `MUSTER-` placeholder below with the
 * real operator details. All five surfaces (directwerk-web, directwerk-studio,
 * directwerk-admin, homepage, directwerk-docs) render from here, so one edit
 * updates every Impressum/Datenschutz page.
 *
 * Tenant apps (directwerk-web/-studio) currently show this platform imprint as the
 * alpha default. Tenant-customizable legal texts (via site-config, see
 * `docs/content-platform-strategy.md`) are a follow-up.
 */
export const OPERATOR = {
    name: 'MUSTER-Betreiber GmbH',
    street: 'Musterstraße 1',
    city: '12345 Musterstadt',
    country: 'Deutschland',
    email: 'hello@directwerk.org',
    phone: '+49 30 00000000',
    registerCourt: 'Amtsgericht Musterstadt',
    registerNumber: 'HRB 000000',
    vatId: 'DE000000000',
    responsiblePerson: 'Max Mustermann, Anschrift wie oben',
} as const
