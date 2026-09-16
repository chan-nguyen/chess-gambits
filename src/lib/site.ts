/**
 * The site's name.
 *
 * Deliberately not translated. It is what a visitor types into a search engine and reads
 * in a shared link, and a name that changed with the interface language would make the
 * same site look like three different ones.
 *
 * Here rather than inline in the header, because the header is no longer the only thing
 * that spells it: every route shell puts it in its `<title>` and its `og:site_name`
 * (ADR-0009), and two spellings of one name is how a rename half-lands.
 *
 * Free of browser APIs, so the Node build script can import it.
 */
export const siteName = 'Chess Gambit Trainer'
