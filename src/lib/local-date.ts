// Dates « calendrier » de l'application.
//
// Tout l'existant utilisait `new Date().toISOString().slice(0, 10)` : c'est la
// date UTC. En France (UTC+1/+2), entre minuit et ~2 h du matin, « aujourd'hui »
// vaut la veille → séance datée du mauvais jour, « séance du jour » qui ne
// matche plus, planning décalé. L'app étant française (et le serveur Cloudflare
// en UTC), la référence est le fuseau Europe/Paris, côté client comme serveur.

const TZ = "Europe/Paris";

/** Date locale (Europe/Paris) au format YYYY-MM-DD. */
export function localDateISO(d: Date = new Date()): string {
  // fr-CA formate nativement en YYYY-MM-DD.
  return new Intl.DateTimeFormat("fr-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Arithmétique sur une date YYYY-MM-DD (sans passer par le fuseau local). */
export function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
