import {OPERATOR} from './operator'
import type {LegalPage} from './legal'

/**
 * Shared Datenschutzerklärung (Art. 13 DSGVO) rendered on all five surfaces.
 * Describes the platform as it actually runs: EU hosting, token sessions in
 * the browser, optional Umami analytics, Stripe billing. Operator details
 * come from {@link OPERATOR} — edit them there, not here.
 */
export const PRIVACY: LegalPage = {
    title: 'Datenschutzerklärung',
    intro:
        'Wir nehmen den Schutz deiner Daten ernst. Nachfolgend erfährst du, welche Daten wir verarbeiten, wofür wir sie brauchen und welche Rechte du hast.',
    updated: '2026-09-06',
    sections: [
        {
            heading: '1. Verantwortlicher',
            paragraphs: [
                `Verantwortlicher im Sinne der DSGVO ist ${OPERATOR.name}, ${OPERATOR.street}, ${OPERATOR.city}, ${OPERATOR.country}, E-Mail: ${OPERATOR.email}.`,
            ],
        },
        {
            heading: '2. Hosting und Server-Logs',
            paragraphs: [
                'Unsere Dienste laufen auf Servern in der Europäischen Union. Beim Aufruf werden technisch notwendige Zugriffsdaten (IP-Adresse, Datum und Uhrzeit, aufgerufene Seite, Browsertyp) in Server-Logs verarbeitet, um Betrieb und Sicherheit zu gewährleisten (Art. 6 Abs. 1 lit. f DSGVO). Logs werden kurz aufbewahrt und danach gelöscht oder anonymisiert.',
            ],
        },
        {
            heading: '3. Konto und Anmeldung',
            paragraphs: [
                'Für Studio, Abos und personalisierte Feeds verarbeiten wir E-Mail-Adresse, Zugangsdaten (Passwörter ausschließlich als Hash) und Mandantenzugehörigkeit (Art. 6 Abs. 1 lit. b DSGVO). Sitzungen nutzen kurzlebige Zugriffstoken im Browser-Speicher sowie ein Refresh-Token; mit „Abmelden“ werden sie verworfen.',
            ],
        },
        {
            heading: '4. Cookies und lokale Speicherung',
            paragraphs: [
                'Wir setzen keine Werbe- oder Tracking-Cookies. Technisch notwendige Speicherung (Sitzungs- und Refresh-Token, angemeldeter Mandant) dient ausschließlich der Anmeldung und ist für die Nutzung erforderlich.',
            ],
        },
        {
            heading: '5. Reichweitenmessung (Umami)',
            paragraphs: [
                'Soweit aktiviert, messen wir Reichweite mit der selbst gehosteten, cookielosen Analyse-Software Umami (Art. 6 Abs. 1 lit. f DSGVO, berechtigtes Interesse an sparsamer, datenschutzfreundlicher Statistik). Es werden keine geräteübergreifenden Profile gebildet.',
            ],
        },
        {
            heading: '6. Zahlungen',
            paragraphs: [
                'Bezahlte Mitgliedschaften werden über Stripe abgewickelt. Dabei erhält Stripe die für die Zahlung erforderlichen Daten (z. B. E-Mail-Adresse, Zahlungsdaten, gewähltes Produkt); es gilt zusätzlich die Datenschutzerklärung von Stripe. Rechtsgrundlage ist die Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO).',
            ],
        },
        {
            heading: '7. E-Mail und Benachrichtigungen',
            paragraphs: [
                'Für Kontobenachrichtigungen (z. B. Einladungen, Zahlungsstatus, optionale Inhalts-Updates) verarbeiten wir E-Mail-Adresse und Versandstatus (Art. 6 Abs. 1 lit. b bzw. lit. a DSGVO). Einwilligungen kannst du jederzeit mit Wirkung für die Zukunft widerrufen.',
            ],
        },
        {
            heading: '8. Medien und Auslieferung (CDN)',
            paragraphs: [
                'Audio-, Bild- und Feed-Dateien werden über EU-basierte Speicher- und CDN-Infrastruktur ausgeliefert. Beim Abruf fallen die üblichen Zugriffsdaten (siehe 2.) an; private Feeds und Streams sind zusätzlich per Token bzw. Anmeldung geschützt.',
            ],
        },
        {
            heading: '9. Speicherdauer',
            paragraphs: [
                'Wir speichern personenbezogene Daten nur so lange, wie es für die genannten Zwecke oder gesetzliche Aufbewahrungspflichten (z. B. Handels- und Steuerrecht) erforderlich ist. Kontodaten löschen wir nach Beendigung des Nutzungsverhältnisses, soweit keine Pflichten entgegenstehen.',
            ],
        },
        {
            heading: '10. Deine Rechte',
            paragraphs: [
                'Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit sowie Widerspruch gegen Verarbeitungen auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO (Art. 15–21 DSGVO). Wende dich dazu einfach an die oben genannte Kontaktadresse.',
            ],
        },
        {
            heading: '11. Beschwerderecht',
            paragraphs: [
                'Du hast das Recht, dich bei einer Datenschutz-Aufsichtsbehörde zu beschweren — zum Beispiel bei der für deinen Wohnsitz zuständigen Behörde.',
            ],
        },
        {
            heading: '12. Änderungen',
            paragraphs: [
                'Wir passen diese Erklärung an, wenn sich unsere Verarbeitung oder die Rechtslage ändert. Die jeweils aktuelle Fassung findest du immer auf dieser Seite.',
            ],
        },
    ],
}
