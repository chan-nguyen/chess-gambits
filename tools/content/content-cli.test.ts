// @vitest-environment node
import { spawnSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'

/**
 * The three commands this ticket adds, run the way a person and CI run them. Exit codes are
 * the contract here: `npm run build` chains them with `&&`, so a command that printed an
 * error and exited zero would publish broken content while the log said it had failed.
 */

const root = fileURLToPath(new URL('../../', import.meta.url))
const fixturePgn = 'tools/content/fixtures/pgn/damiano-two-branches.pgn'

const run = (script: string, ...args: string[]) =>
  spawnSync(process.execPath, [`tools/content/${script}`, ...args], { cwd: root, encoding: 'utf8' })

const temporary: string[] = []
const scratch = (): string => {
  const directory = mkdtempSync(join(tmpdir(), 'content-pipeline-'))
  temporary.push(directory)
  return directory
}

afterAll(() => {
  for (const directory of temporary) spawnSync('rm', ['-rf', directory])
})

describe('import-pgn (AC 1)', () => {
  it('writes a YAML skeleton and reports what it found', () => {
    const out = join(scratch(), 'imported.yaml')
    const result = run(
      'import-cli.ts',
      fixturePgn,
      '--side',
      'white',
      '--soundness',
      'sound',
      '--category',
      'trap',
      '--out',
      out,
    )

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('defining line   e4 e5 Nf3 f6 Nxe5 fxe5 Qh5+')
    expect(result.stdout).toContain('branch points   1')
    expect(readFileSync(out, 'utf8')).toContain('ply: Ke7')
  })

  it('says the skeleton already passes the gate when it does', () => {
    const out = join(scratch(), 'imported.yaml')
    const result = run(
      'import-cli.ts',
      fixturePgn,
      '--side',
      'white',
      '--soundness',
      'sound',
      '--out',
      out,
    )

    expect(result.stdout).toContain('passes the content gate')
  })

  it('lists what the gate still demands when the PGN left replies unanswered', () => {
    const directory = scratch()
    const pgn = join(directory, 'partial.pgn')
    writeFileSync(
      pgn,
      '[ECO "C40"]\n[Annotator "t"]\n\n1. e4 e5 2. Nf3 f6 3. Nxe5 fxe5 (3... Qe7) *\n',
    )
    const result = run(
      'import-cli.ts',
      pgn,
      '--side',
      'white',
      '--soundness',
      'sound',
      '--out',
      join(directory, 'p.yaml'),
    )

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('[reply-incomplete]')
    expect(result.stdout).toContain('does not invent them')
  })

  it('refuses without a side, because side decides every derived kind', () => {
    const result = run('import-cli.ts', fixturePgn, '--soundness', 'sound')

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('`--side` is required')
  })

  it('refuses without a soundness label, rather than choosing one', () => {
    const result = run('import-cli.ts', fixturePgn, '--side', 'white')

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('`--soundness` is required')
  })

  /** After the first import the YAML is the source of truth; a second one would erase it. */
  it('refuses to overwrite an entry that already exists', () => {
    const out = join(scratch(), 'imported.yaml')
    const args = [fixturePgn, '--side', 'white', '--soundness', 'sound', '--out', out]

    expect(run('import-cli.ts', ...args).status).toBe(0)
    const second = run('import-cli.ts', ...args)

    expect(second.status).toBe(1)
    expect(second.stderr).toContain('will not be overwritten')
  })
})

describe('export-pgn (AC 2)', () => {
  it('prints a PGN for a published entry', () => {
    const result = run('export-cli.ts', 'damiano-defence-refutation')

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('[ECO "C40"]')
    expect(result.stdout).toContain('1. e4')
  })

  it('names the ids it does know when asked for one it does not', () => {
    const result = run('export-cli.ts', 'no-such-gambit')

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(
      'Known ids: alekhine-defense-krejcik-variation-krejcik-gambit, alekhine-defense-osullivan-gambit, alekhine-defense-scandinavian-variation-geschev-gambit, alekhine-defense-spielmann-gambit, amar-opening-paris-gambit-gent-gambit, barnes-opening-gedult-gambit, benko-gambit, benko-gambit-accepted, benko-gambit-declined-bishop-attack, benko-gambit-fianchetto-variation, benoni-defense-benoni-gambit-accepted, bird-opening-froms-gambit, bird-opening-froms-gambit-bahr-gambit, bird-opening-hobbs-gambit, bird-opening-lasker-gambit, bishops-opening-anderssen-gambit, bishops-opening-calabrese-countergambit, bishops-opening-khan-gambit, bishops-opening-lewis-countergambit, bishops-opening-lewis-gambit, bishops-opening-ponziani-gambit, bishops-opening-stein-gambit, bishops-opening-warsaw-gambit, blackmar-diemer-gambit, blackmar-diemer-gambit-accepted, blackmar-diemer-gambit-blackmar-gambit, blackmar-diemer-gambit-declined-brombacher-countergambit, blackmar-diemer-gambit-reversed-albin-countergambit, blumenfeld-countergambit, blumenfeld-countergambit-accepted, borg-defense-borg-gambit, borg-defense-troon-gambit, borg-defense-zilbermints-gambit, caro-kann-defense-labahn-attack-double-gambit, caro-kann-defense-mieses-gambit, carr-defense-zilbermints-gambit, catalan-opening-hungarian-gambit, center-game-halasz-mcdonnell-gambit, damiano-defence-refutation, danish-gambit, danish-gambit-accepted, danish-gambit-accepted-classical-defense, danish-gambit-accepted-svenonius-defense, danish-gambit-declined-sorensen-defense, duras-gambit, dutch-defense-bellon-gambit, dutch-defense-krejcik-gambit, elephant-gambit, elephant-gambit-maroczy-gambit, elephant-gambit-paulsen-countergambit, elephant-trap, english-defense-eastbourne-gambit, english-opening-jaenisch-gambit, english-opening-wing-gambit, englund-gambit, englund-gambit-declined, englund-gambit-felbecker-gambit, englund-gambit-hartlaub-charlick-gambit, englund-gambit-main-line, englund-gambit-mosquito-gambit, englund-gambit-soller-gambit, englund-gambit-soller-gambit-deferred, englund-gambit-trap, englund-gambit-zilbermints-gambit, fishing-pole-trap, four-knights-game-halloween-gambit, french-defense-banzai-leong-gambit, french-defense-wing-gambit, grob-opening-alessi-gambit, grob-opening-grob-gambit-declined, grunfeld-defense-gibbon-gambit, halosar-trap, horwitz-defense-zilbermints-gambit, hungarian-opening-asten-gambit, hungarian-opening-van-kuijk-gambit, indian-defense-budapest-gambit, indian-defense-budapest-gambit-accepted-fajarowicz-defense, indian-defense-gibbins-weidenhagen-gambit, indian-defense-lazard-gambit, irish-gambit, italian-game-blackburne-kostic-gambit, italian-game-evans-gambit, italian-game-jerome-gambit, italian-game-rosentreter-gambit, italian-game-rousseau-gambit, italian-game-two-knights-defense-fried-liver-attack, kadas-opening-kadas-gambit, kadas-opening-schneider-gambit, kadas-opening-steinbok-gambit, kieninger-trap, kings-gambit, kings-gambit-accepted, kings-gambit-accepted-basman-gambit, kings-gambit-accepted-becker-defense, kings-gambit-accepted-bishops-gambit, kings-gambit-accepted-bishops-gambit-anderssen-defense, kings-gambit-accepted-bishops-gambit-bledow-variation, kings-gambit-accepted-bishops-gambit-cozio-defense, kings-gambit-accepted-bishops-gambit-gianutio-gambit, kings-gambit-accepted-bishops-gambit-kieseritzky-gambit, kings-gambit-accepted-bishops-gambit-lopez-defense, kings-gambit-accepted-bishops-gambit-maurian-defense, kings-gambit-accepted-bishops-gambit-steinitz-defense, kings-gambit-accepted-bonsch-osmolovsky-variation, kings-gambit-accepted-breyer-gambit, kings-gambit-accepted-carrera-gambit, kings-gambit-accepted-cunningham-defense, kings-gambit-accepted-dodo-variation, kings-gambit-accepted-eisenberg-variation, kings-gambit-accepted-fischer-defense, kings-gambit-accepted-gaga-gambit, kings-gambit-accepted-ghulam-kassim-gambit, kings-gambit-accepted-gianutio-countergambit, kings-gambit-accepted-hanstein-gambit, kings-gambit-accepted-kieseritzky-gambit, kings-gambit-accepted-kieseritzky-gambit-berlin-defense, kings-gambit-accepted-kieseritzky-gambit-brentano-defense, kings-gambit-accepted-kieseritzky-gambit-kolisch-defense, kings-gambit-accepted-kings-knights-gambit, kings-gambit-accepted-macleod-defense, kings-gambit-accepted-mason-keres-gambit, kings-gambit-accepted-mayet-gambit, kings-gambit-accepted-mcdonnell-gambit, kings-gambit-accepted-modern-defense, kings-gambit-accepted-muzio-gambit-wild-muzio-gambit, kings-gambit-accepted-orsini-gambit, kings-gambit-accepted-paris-gambit, kings-gambit-accepted-philidor-gambit, kings-gambit-accepted-philidor-gambit-schultz-variation, kings-gambit-accepted-quaade-gambit, kings-gambit-accepted-rosentreter-gambit, kings-gambit-accepted-rosentreter-gambit-sorensen-gambit, kings-gambit-accepted-salvio-gambit, kings-gambit-accepted-schallopp-defense, kings-gambit-accepted-schallopp-defense-tashkent-attack, kings-gambit-accepted-schurig-gambit-with-bb5, kings-gambit-accepted-schurig-gambit-with-bd3, kings-gambit-accepted-sorensen-gambit, kings-gambit-accepted-stamma-gambit, kings-gambit-accepted-tartakower-gambit, kings-gambit-accepted-tartakower-gambit-weiss-defense, kings-gambit-accepted-traditional-variation, kings-gambit-accepted-tumbleweed, kings-gambit-accepted-villemson-gambit, kings-gambit-accepted-wagenbach-defense, kings-gambit-declined-classical-hanham-variation, kings-gambit-declined-classical-soldatenkov-variation, kings-gambit-declined-classical-variation, kings-gambit-declined-falkbeer-countergambit, kings-gambit-declined-falkbeer-countergambit-accepted, kings-gambit-declined-falkbeer-countergambit-hinrichsen-gambit, kings-gambit-declined-falkbeer-countergambit-modern-transfer, kings-gambit-declined-falkbeer-countergambit-staunton-line, kings-gambit-declined-hobbs-zilbermints-gambit, kings-gambit-declined-keenes-defense, kings-gambit-declined-mafia-defense, kings-gambit-declined-norwalde-variation, kings-gambit-declined-norwalde-variation-bucker-gambit, kings-gambit-declined-norwalde-variation-schubert-variation, kings-gambit-declined-panteldakis-countergambit, kings-gambit-declined-panteldakis-countergambit-shirazi-line, kings-gambit-declined-petrovs-defense, kings-gambit-declined-queens-knight-defense, kings-gambit-declined-zilbermints-double-countergambit, kings-indian-attack-omega-delta-gambit, kings-indian-defense-samisch-variation-samisch-gambit, kings-pawn-game-bavarian-gambit, kings-pawn-game-beyer-gambit, kings-pawn-game-busch-gass-gambit, kings-pawn-game-busch-gass-gambit-chiodini-gambit, kings-pawn-game-clam-variation-kings-gambit-reversed, kings-pawn-game-gunderam-defense-gunderam-gambit, kings-pawn-game-gunderam-gambit, kings-pawn-game-pachman-wing-gambit, kings-pawn-game-philidor-gambit, kings-pawn-game-schulze-muller-gambit, kings-pawn-game-tayler-opening-basman-gambit, kings-pawn-game-wayward-queen-attack-kiddie-countergambit, kings-pawn-game-weber-gambit, kings-pawn-opening-van-hooydoon-gambit, lasker-trap, latvian-gambit, latvian-gambit-accepted, latvian-gambit-accepted-leonhardt-variation, latvian-gambit-behting-variation, latvian-gambit-corkscrew-countergambit, latvian-gambit-corkscrew-gambit, latvian-gambit-lobster-gambit, latvian-gambit-mason-countergambit, latvian-gambit-mayet-attack, legals-mate, lion-defense-anti-philidor-lions-cave-lion-claw-gambit, mexican-defense-horsefly-gambit, mikenas-defense-pozarek-gambit, milner-barry-trap, modern-defense-lizard-defense-pirc-diemer-gambit, modern-defense-masur-gambit, modern-defense-westermann-gambit, modern-defense-wind-gambit, monticelli-trap, mortimer-trap, nimzo-indian-defense-classical-variation-belyavsky-gambit, nimzo-indian-defense-dilworth-gambit, nimzo-larsen-attack-norfolk-gambit, nimzo-larsen-attack-pachman-gambit, nimzo-larsen-attack-ringelbach-gambit, nimzowitsch-defense-colorado-countergambit, nimzowitsch-defense-hornung-gambit, nimzowitsch-defense-kennedy-variation-bielefelder-gambit, nimzowitsch-defense-kennedy-variation-de-smet-gambit, nimzowitsch-defense-kennedy-variation-hammer-gambit, nimzowitsch-defense-kennedy-variation-herford-gambit, nimzowitsch-defense-wheeler-gambit, noahs-ark-trap, old-indian-defense-aged-gibbon-gambit, owen-defense-naselwaus-gambit, owen-defense-smith-gambit, owen-defense-wind-gambit, panov-attack-fianchetto-defense-fianchetto-gambit, petrovs-defense-cochrane-gambit, petrovs-defense-marshall-trap, petrovs-defense-moody-gambit, petrovs-defense-stafford-gambit, petrovs-defense-stafford-gambit-accepted, philidor-defense-bird-gambit, philidor-defense-lopez-countergambit, philidor-defense-morphy-gambit, philidor-defense-philidor-countergambit, philidor-defense-philidor-gambit, pirc-defense-roscher-gambit, polish-defense-spassky-gambit-accepted, polish-opening-birmingham-gambit, polish-opening-tartakower-gambit, ponziani-opening-ponziani-countergambit, portuguese-opening-miguel-gambit, portuguese-opening-portuguese-gambit, queens-gambit-declined-albin-countergambit, queens-gambit-declined-albin-countergambit-modern-line, queens-gambit-declined-albin-countergambit-normal-line, queens-gambit-declined-albin-countergambit-spassky-variation, queens-gambit-declined-albin-countergambit-tartakower-defense, queens-indian-defense-classical-variation-polugaevsky-gambit, queens-pawn-game-chigorin-variation-irish-gambit, queens-pawn-game-hubsch-gambit, queens-pawn-game-zurich-gambit, rat-defense-english-rat-lisbon-gambit, reti-opening-zilbermints-gambit, richter-veresov-attack-malich-gambit, rubinstein-trap, ruy-lopez-closed-chigorin-defense-gajewski-gambit, ruy-lopez-exchange-variation-alapin-gambit, ruy-lopez-halloween-attack, ruy-lopez-marshall-attack, ruy-lopez-marshall-attack-steiner-variation, ruy-lopez-morphy-defense-jaffe-gambit, ruy-lopez-morphy-defense-norwegian-variation-nightingale-gambit, ruy-lopez-open-karpov-gambit, ruy-lopez-schliemann-defense, ruy-lopez-spanish-countergambit, ruy-lopez-steinitz-defense-center-gambit, scandinavian-defense-blackburne-gambit, scandinavian-defense-blackburne-kloosterboer-gambit, scandinavian-defense-boehnke-gambit, scandinavian-defense-icelandic-palme-gambit, scandinavian-defense-kadas-gambit, scandinavian-defense-kiel-variation-trap, scandinavian-defense-main-line-leonhardt-gambit, scandinavian-defense-portuguese-gambit, scandinavian-defense-zilbermints-gambit, scandinavian-variation-bogoljubow-variation-richter-gambit, scotch-game-alekhine-gambit, scotch-game-goring-gambit, scotch-game-goring-gambit-double-pawn-sacrifice, scotch-game-napoleon-gambit, scotch-game-relfsson-gambit, scotch-game-scotch-gambit, scotch-game-scotch-gambit-advance-variation, scotch-game-scotch-gambit-sarratt-variation, scotch-variation-krause-gambit-leonhardt-defense, semi-slav-defense-anti-moscow-gambit, semi-slav-defense-gunderam-gambit, semi-slav-defense-marshall-gambit, semi-slav-defense-marshall-gambit-main-line, semi-slav-defense-noteboom-variation-anti-noteboom-gambit, siberian-trap, sicilian-defense-alapin-variation-anti-alapin-gambit, sicilian-defense-brussels-gambit, sicilian-defense-coles-sicilian-gambit, sicilian-defense-double-dutch-gambit, sicilian-defense-euwe-attack-prins-gambit, sicilian-defense-halasz-gambit, sicilian-defense-kotov-gambit, sicilian-defense-kronberger-variation-nemeth-gambit, sicilian-defense-mcdonnell-attack-tal-gambit, sicilian-defense-modern-variations-ginsberg-gambit, sicilian-defense-morphy-gambit, sicilian-defense-morphy-gambit-andreaschek-gambit, sicilian-defense-moscow-variation-haag-gambit, sicilian-defense-najdorf-variation-dekker-gambit, sicilian-defense-okelly-variation-normal-system-cortlever-gambit, sicilian-defense-okelly-variation-wing-gambit, sicilian-defense-polish-gambit, sicilian-defense-portsmouth-gambit, sicilian-defense-smith-morra-gambit, sicilian-defense-smith-morra-gambit-accepted-danish-variation, sicilian-defense-smith-morra-gambit-deferred, sicilian-defense-wing-gambit, sicilian-defense-wing-gambit-abrahams-variation, sicilian-defense-wing-gambit-marshall-variation, slav-defense-diemer-gambit, slav-defense-geller-gambit, slav-defense-slav-gambit-alekhine-attack, slav-defense-winawer-countergambit, smith-morra-gambit-accepted-open-d-file-trap, sodium-attack-durkin-gambit, st-george-defense-zilbermints-gambit, stafford-gambit-rosen-trap, tarrasch-defense-classical-variation-classical-tarrasch-gambit, tarrasch-defense-grunfeld-gambit, tarrasch-defense-schara-gambit, tarrasch-defense-tarrasch-gambit, tarrasch-defense-von-hennig-gambit, tarrasch-trap, tarrasch-variation-open-system-shaposhnikov-gambit, torre-attack-classical-defense-petrosian-gambit, torre-attack-wagner-gambit, traxler-counterattack-ke2-trap, trompowsky-attack-edge-variation-hergert-gambit, trompowsky-attack-raptor-variation-hergert-gambit, two-knights-defense-ulvestad-variation-kurkin-gambit, van-geet-opening-berlin-gambit, van-geet-opening-dougherty-gambit, van-geet-opening-hector-gambit, van-geet-opening-laroche-gambit, van-geet-opening-sleipnir-gambit, vant-kruijs-opening-keoni-hiva-gambit-akahi-variation, vant-kruijs-opening-keoni-hiva-gambit-alua-variation, vienna-gambit-with-max-lange-defense, vienna-gambit-with-max-lange-defense-knight-variation, vienna-gambit-with-max-lange-defense-pierce-gambit, vienna-game-adams-gambit, vienna-game-frankenstein-dracula-qd5-trap, vienna-game-frankenstein-dracula-variation, vienna-game-fyfe-gambit, vienna-game-omaha-gambit, vienna-game-philidor-countergambit, vienna-game-vienna-gambit, vienna-game-vienna-gambit-steinitz-variation, vienna-game-wurzburger-trap, ware-opening-ware-gambit, ware-opening-wing-gambit, zukertort-opening-herrstrom-gambit, zukertort-opening-lemberger-gambit, zukertort-opening-lisitsyn-gambit, zukertort-opening-ross-gambit, zukertort-opening-shabalov-gambit, zukertort-opening-tennison-gambit, zukertort-opening-tennison-gambit-briggs-trap, zukertort-opening-vos-gambit.',
    )
  })

  /** The export is generated; a `.pgn` committed beside its `.yaml` is a second source of truth. */
  it('refuses to write into the content directory', () => {
    const result = run('export-cli.ts', 'damiano-defence-refutation', '--out', 'content/x.pgn')

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('second source of truth')
    expect(existsSync(join(root, 'content/x.pgn'))).toBe(false)
  })
})

describe('compile (AC 3)', () => {
  it('writes one minified JSON file per entry', () => {
    const out = scratch()
    const result = run('compile-cli.ts', '--out', out)

    expect(result.status).toBe(0)
    expect([...readdirSync(out)].sort()).toStrictEqual([
      'alekhine-defense-krejcik-variation-krejcik-gambit.json',
      'alekhine-defense-osullivan-gambit.json',
      'alekhine-defense-scandinavian-variation-geschev-gambit.json',
      'alekhine-defense-spielmann-gambit.json',
      'amar-opening-paris-gambit-gent-gambit.json',
      'barnes-opening-gedult-gambit.json',
      'benko-gambit-accepted.json',
      'benko-gambit-declined-bishop-attack.json',
      'benko-gambit-fianchetto-variation.json',
      'benko-gambit.json',
      'benoni-defense-benoni-gambit-accepted.json',
      'bird-opening-froms-gambit-bahr-gambit.json',
      'bird-opening-froms-gambit.json',
      'bird-opening-hobbs-gambit.json',
      'bird-opening-lasker-gambit.json',
      'bishops-opening-anderssen-gambit.json',
      'bishops-opening-calabrese-countergambit.json',
      'bishops-opening-khan-gambit.json',
      'bishops-opening-lewis-countergambit.json',
      'bishops-opening-lewis-gambit.json',
      'bishops-opening-ponziani-gambit.json',
      'bishops-opening-stein-gambit.json',
      'bishops-opening-warsaw-gambit.json',
      'blackmar-diemer-gambit-accepted.json',
      'blackmar-diemer-gambit-blackmar-gambit.json',
      'blackmar-diemer-gambit-declined-brombacher-countergambit.json',
      'blackmar-diemer-gambit-reversed-albin-countergambit.json',
      'blackmar-diemer-gambit.json',
      'blumenfeld-countergambit-accepted.json',
      'blumenfeld-countergambit.json',
      'borg-defense-borg-gambit.json',
      'borg-defense-troon-gambit.json',
      'borg-defense-zilbermints-gambit.json',
      'caro-kann-defense-labahn-attack-double-gambit.json',
      'caro-kann-defense-mieses-gambit.json',
      'carr-defense-zilbermints-gambit.json',
      'catalan-opening-hungarian-gambit.json',
      'center-game-halasz-mcdonnell-gambit.json',
      'damiano-defence-refutation.json',
      'danish-gambit-accepted-classical-defense.json',
      'danish-gambit-accepted-svenonius-defense.json',
      'danish-gambit-accepted.json',
      'danish-gambit-declined-sorensen-defense.json',
      'danish-gambit.json',
      'duras-gambit.json',
      'dutch-defense-bellon-gambit.json',
      'dutch-defense-krejcik-gambit.json',
      'elephant-gambit-maroczy-gambit.json',
      'elephant-gambit-paulsen-countergambit.json',
      'elephant-gambit.json',
      'elephant-trap.json',
      'english-defense-eastbourne-gambit.json',
      'english-opening-jaenisch-gambit.json',
      'english-opening-wing-gambit.json',
      'englund-gambit-declined.json',
      'englund-gambit-felbecker-gambit.json',
      'englund-gambit-hartlaub-charlick-gambit.json',
      'englund-gambit-main-line.json',
      'englund-gambit-mosquito-gambit.json',
      'englund-gambit-soller-gambit-deferred.json',
      'englund-gambit-soller-gambit.json',
      'englund-gambit-trap.json',
      'englund-gambit-zilbermints-gambit.json',
      'englund-gambit.json',
      'fishing-pole-trap.json',
      'four-knights-game-halloween-gambit.json',
      'french-defense-banzai-leong-gambit.json',
      'french-defense-wing-gambit.json',
      'grob-opening-alessi-gambit.json',
      'grob-opening-grob-gambit-declined.json',
      'grunfeld-defense-gibbon-gambit.json',
      'halosar-trap.json',
      'horwitz-defense-zilbermints-gambit.json',
      'hungarian-opening-asten-gambit.json',
      'hungarian-opening-van-kuijk-gambit.json',
      'indian-defense-budapest-gambit-accepted-fajarowicz-defense.json',
      'indian-defense-budapest-gambit.json',
      'indian-defense-gibbins-weidenhagen-gambit.json',
      'indian-defense-lazard-gambit.json',
      'irish-gambit.json',
      'italian-game-blackburne-kostic-gambit.json',
      'italian-game-evans-gambit.json',
      'italian-game-jerome-gambit.json',
      'italian-game-rosentreter-gambit.json',
      'italian-game-rousseau-gambit.json',
      'italian-game-two-knights-defense-fried-liver-attack.json',
      'kadas-opening-kadas-gambit.json',
      'kadas-opening-schneider-gambit.json',
      'kadas-opening-steinbok-gambit.json',
      'kieninger-trap.json',
      'kings-gambit-accepted-basman-gambit.json',
      'kings-gambit-accepted-becker-defense.json',
      'kings-gambit-accepted-bishops-gambit-anderssen-defense.json',
      'kings-gambit-accepted-bishops-gambit-bledow-variation.json',
      'kings-gambit-accepted-bishops-gambit-cozio-defense.json',
      'kings-gambit-accepted-bishops-gambit-gianutio-gambit.json',
      'kings-gambit-accepted-bishops-gambit-kieseritzky-gambit.json',
      'kings-gambit-accepted-bishops-gambit-lopez-defense.json',
      'kings-gambit-accepted-bishops-gambit-maurian-defense.json',
      'kings-gambit-accepted-bishops-gambit-steinitz-defense.json',
      'kings-gambit-accepted-bishops-gambit.json',
      'kings-gambit-accepted-bonsch-osmolovsky-variation.json',
      'kings-gambit-accepted-breyer-gambit.json',
      'kings-gambit-accepted-carrera-gambit.json',
      'kings-gambit-accepted-cunningham-defense.json',
      'kings-gambit-accepted-dodo-variation.json',
      'kings-gambit-accepted-eisenberg-variation.json',
      'kings-gambit-accepted-fischer-defense.json',
      'kings-gambit-accepted-gaga-gambit.json',
      'kings-gambit-accepted-ghulam-kassim-gambit.json',
      'kings-gambit-accepted-gianutio-countergambit.json',
      'kings-gambit-accepted-hanstein-gambit.json',
      'kings-gambit-accepted-kieseritzky-gambit-berlin-defense.json',
      'kings-gambit-accepted-kieseritzky-gambit-brentano-defense.json',
      'kings-gambit-accepted-kieseritzky-gambit-kolisch-defense.json',
      'kings-gambit-accepted-kieseritzky-gambit.json',
      'kings-gambit-accepted-kings-knights-gambit.json',
      'kings-gambit-accepted-macleod-defense.json',
      'kings-gambit-accepted-mason-keres-gambit.json',
      'kings-gambit-accepted-mayet-gambit.json',
      'kings-gambit-accepted-mcdonnell-gambit.json',
      'kings-gambit-accepted-modern-defense.json',
      'kings-gambit-accepted-muzio-gambit-wild-muzio-gambit.json',
      'kings-gambit-accepted-orsini-gambit.json',
      'kings-gambit-accepted-paris-gambit.json',
      'kings-gambit-accepted-philidor-gambit-schultz-variation.json',
      'kings-gambit-accepted-philidor-gambit.json',
      'kings-gambit-accepted-quaade-gambit.json',
      'kings-gambit-accepted-rosentreter-gambit-sorensen-gambit.json',
      'kings-gambit-accepted-rosentreter-gambit.json',
      'kings-gambit-accepted-salvio-gambit.json',
      'kings-gambit-accepted-schallopp-defense-tashkent-attack.json',
      'kings-gambit-accepted-schallopp-defense.json',
      'kings-gambit-accepted-schurig-gambit-with-bb5.json',
      'kings-gambit-accepted-schurig-gambit-with-bd3.json',
      'kings-gambit-accepted-sorensen-gambit.json',
      'kings-gambit-accepted-stamma-gambit.json',
      'kings-gambit-accepted-tartakower-gambit-weiss-defense.json',
      'kings-gambit-accepted-tartakower-gambit.json',
      'kings-gambit-accepted-traditional-variation.json',
      'kings-gambit-accepted-tumbleweed.json',
      'kings-gambit-accepted-villemson-gambit.json',
      'kings-gambit-accepted-wagenbach-defense.json',
      'kings-gambit-accepted.json',
      'kings-gambit-declined-classical-hanham-variation.json',
      'kings-gambit-declined-classical-soldatenkov-variation.json',
      'kings-gambit-declined-classical-variation.json',
      'kings-gambit-declined-falkbeer-countergambit-accepted.json',
      'kings-gambit-declined-falkbeer-countergambit-hinrichsen-gambit.json',
      'kings-gambit-declined-falkbeer-countergambit-modern-transfer.json',
      'kings-gambit-declined-falkbeer-countergambit-staunton-line.json',
      'kings-gambit-declined-falkbeer-countergambit.json',
      'kings-gambit-declined-hobbs-zilbermints-gambit.json',
      'kings-gambit-declined-keenes-defense.json',
      'kings-gambit-declined-mafia-defense.json',
      'kings-gambit-declined-norwalde-variation-bucker-gambit.json',
      'kings-gambit-declined-norwalde-variation-schubert-variation.json',
      'kings-gambit-declined-norwalde-variation.json',
      'kings-gambit-declined-panteldakis-countergambit-shirazi-line.json',
      'kings-gambit-declined-panteldakis-countergambit.json',
      'kings-gambit-declined-petrovs-defense.json',
      'kings-gambit-declined-queens-knight-defense.json',
      'kings-gambit-declined-zilbermints-double-countergambit.json',
      'kings-gambit.json',
      'kings-indian-attack-omega-delta-gambit.json',
      'kings-indian-defense-samisch-variation-samisch-gambit.json',
      'kings-pawn-game-bavarian-gambit.json',
      'kings-pawn-game-beyer-gambit.json',
      'kings-pawn-game-busch-gass-gambit-chiodini-gambit.json',
      'kings-pawn-game-busch-gass-gambit.json',
      'kings-pawn-game-clam-variation-kings-gambit-reversed.json',
      'kings-pawn-game-gunderam-defense-gunderam-gambit.json',
      'kings-pawn-game-gunderam-gambit.json',
      'kings-pawn-game-pachman-wing-gambit.json',
      'kings-pawn-game-philidor-gambit.json',
      'kings-pawn-game-schulze-muller-gambit.json',
      'kings-pawn-game-tayler-opening-basman-gambit.json',
      'kings-pawn-game-wayward-queen-attack-kiddie-countergambit.json',
      'kings-pawn-game-weber-gambit.json',
      'kings-pawn-opening-van-hooydoon-gambit.json',
      'lasker-trap.json',
      'latvian-gambit-accepted-leonhardt-variation.json',
      'latvian-gambit-accepted.json',
      'latvian-gambit-behting-variation.json',
      'latvian-gambit-corkscrew-countergambit.json',
      'latvian-gambit-corkscrew-gambit.json',
      'latvian-gambit-lobster-gambit.json',
      'latvian-gambit-mason-countergambit.json',
      'latvian-gambit-mayet-attack.json',
      'latvian-gambit.json',
      'legals-mate.json',
      'lion-defense-anti-philidor-lions-cave-lion-claw-gambit.json',
      'mexican-defense-horsefly-gambit.json',
      'mikenas-defense-pozarek-gambit.json',
      'milner-barry-trap.json',
      'modern-defense-lizard-defense-pirc-diemer-gambit.json',
      'modern-defense-masur-gambit.json',
      'modern-defense-westermann-gambit.json',
      'modern-defense-wind-gambit.json',
      'monticelli-trap.json',
      'mortimer-trap.json',
      'nimzo-indian-defense-classical-variation-belyavsky-gambit.json',
      'nimzo-indian-defense-dilworth-gambit.json',
      'nimzo-larsen-attack-norfolk-gambit.json',
      'nimzo-larsen-attack-pachman-gambit.json',
      'nimzo-larsen-attack-ringelbach-gambit.json',
      'nimzowitsch-defense-colorado-countergambit.json',
      'nimzowitsch-defense-hornung-gambit.json',
      'nimzowitsch-defense-kennedy-variation-bielefelder-gambit.json',
      'nimzowitsch-defense-kennedy-variation-de-smet-gambit.json',
      'nimzowitsch-defense-kennedy-variation-hammer-gambit.json',
      'nimzowitsch-defense-kennedy-variation-herford-gambit.json',
      'nimzowitsch-defense-wheeler-gambit.json',
      'noahs-ark-trap.json',
      'old-indian-defense-aged-gibbon-gambit.json',
      'owen-defense-naselwaus-gambit.json',
      'owen-defense-smith-gambit.json',
      'owen-defense-wind-gambit.json',
      'panov-attack-fianchetto-defense-fianchetto-gambit.json',
      'petrovs-defense-cochrane-gambit.json',
      'petrovs-defense-marshall-trap.json',
      'petrovs-defense-moody-gambit.json',
      'petrovs-defense-stafford-gambit-accepted.json',
      'petrovs-defense-stafford-gambit.json',
      'philidor-defense-bird-gambit.json',
      'philidor-defense-lopez-countergambit.json',
      'philidor-defense-morphy-gambit.json',
      'philidor-defense-philidor-countergambit.json',
      'philidor-defense-philidor-gambit.json',
      'pirc-defense-roscher-gambit.json',
      'polish-defense-spassky-gambit-accepted.json',
      'polish-opening-birmingham-gambit.json',
      'polish-opening-tartakower-gambit.json',
      'ponziani-opening-ponziani-countergambit.json',
      'portuguese-opening-miguel-gambit.json',
      'portuguese-opening-portuguese-gambit.json',
      'queens-gambit-declined-albin-countergambit-modern-line.json',
      'queens-gambit-declined-albin-countergambit-normal-line.json',
      'queens-gambit-declined-albin-countergambit-spassky-variation.json',
      'queens-gambit-declined-albin-countergambit-tartakower-defense.json',
      'queens-gambit-declined-albin-countergambit.json',
      'queens-indian-defense-classical-variation-polugaevsky-gambit.json',
      'queens-pawn-game-chigorin-variation-irish-gambit.json',
      'queens-pawn-game-hubsch-gambit.json',
      'queens-pawn-game-zurich-gambit.json',
      'rat-defense-english-rat-lisbon-gambit.json',
      'reti-opening-zilbermints-gambit.json',
      'richter-veresov-attack-malich-gambit.json',
      'rubinstein-trap.json',
      'ruy-lopez-closed-chigorin-defense-gajewski-gambit.json',
      'ruy-lopez-exchange-variation-alapin-gambit.json',
      'ruy-lopez-halloween-attack.json',
      'ruy-lopez-marshall-attack-steiner-variation.json',
      'ruy-lopez-marshall-attack.json',
      'ruy-lopez-morphy-defense-jaffe-gambit.json',
      'ruy-lopez-morphy-defense-norwegian-variation-nightingale-gambit.json',
      'ruy-lopez-open-karpov-gambit.json',
      'ruy-lopez-schliemann-defense.json',
      'ruy-lopez-spanish-countergambit.json',
      'ruy-lopez-steinitz-defense-center-gambit.json',
      'scandinavian-defense-blackburne-gambit.json',
      'scandinavian-defense-blackburne-kloosterboer-gambit.json',
      'scandinavian-defense-boehnke-gambit.json',
      'scandinavian-defense-icelandic-palme-gambit.json',
      'scandinavian-defense-kadas-gambit.json',
      'scandinavian-defense-kiel-variation-trap.json',
      'scandinavian-defense-main-line-leonhardt-gambit.json',
      'scandinavian-defense-portuguese-gambit.json',
      'scandinavian-defense-zilbermints-gambit.json',
      'scandinavian-variation-bogoljubow-variation-richter-gambit.json',
      'scotch-game-alekhine-gambit.json',
      'scotch-game-goring-gambit-double-pawn-sacrifice.json',
      'scotch-game-goring-gambit.json',
      'scotch-game-napoleon-gambit.json',
      'scotch-game-relfsson-gambit.json',
      'scotch-game-scotch-gambit-advance-variation.json',
      'scotch-game-scotch-gambit-sarratt-variation.json',
      'scotch-game-scotch-gambit.json',
      'scotch-variation-krause-gambit-leonhardt-defense.json',
      'semi-slav-defense-anti-moscow-gambit.json',
      'semi-slav-defense-gunderam-gambit.json',
      'semi-slav-defense-marshall-gambit-main-line.json',
      'semi-slav-defense-marshall-gambit.json',
      'semi-slav-defense-noteboom-variation-anti-noteboom-gambit.json',
      'siberian-trap.json',
      'sicilian-defense-alapin-variation-anti-alapin-gambit.json',
      'sicilian-defense-brussels-gambit.json',
      'sicilian-defense-coles-sicilian-gambit.json',
      'sicilian-defense-double-dutch-gambit.json',
      'sicilian-defense-euwe-attack-prins-gambit.json',
      'sicilian-defense-halasz-gambit.json',
      'sicilian-defense-kotov-gambit.json',
      'sicilian-defense-kronberger-variation-nemeth-gambit.json',
      'sicilian-defense-mcdonnell-attack-tal-gambit.json',
      'sicilian-defense-modern-variations-ginsberg-gambit.json',
      'sicilian-defense-morphy-gambit-andreaschek-gambit.json',
      'sicilian-defense-morphy-gambit.json',
      'sicilian-defense-moscow-variation-haag-gambit.json',
      'sicilian-defense-najdorf-variation-dekker-gambit.json',
      'sicilian-defense-okelly-variation-normal-system-cortlever-gambit.json',
      'sicilian-defense-okelly-variation-wing-gambit.json',
      'sicilian-defense-polish-gambit.json',
      'sicilian-defense-portsmouth-gambit.json',
      'sicilian-defense-smith-morra-gambit-accepted-danish-variation.json',
      'sicilian-defense-smith-morra-gambit-deferred.json',
      'sicilian-defense-smith-morra-gambit.json',
      'sicilian-defense-wing-gambit-abrahams-variation.json',
      'sicilian-defense-wing-gambit-marshall-variation.json',
      'sicilian-defense-wing-gambit.json',
      'slav-defense-diemer-gambit.json',
      'slav-defense-geller-gambit.json',
      'slav-defense-slav-gambit-alekhine-attack.json',
      'slav-defense-winawer-countergambit.json',
      'smith-morra-gambit-accepted-open-d-file-trap.json',
      'sodium-attack-durkin-gambit.json',
      'st-george-defense-zilbermints-gambit.json',
      'stafford-gambit-rosen-trap.json',
      'tarrasch-defense-classical-variation-classical-tarrasch-gambit.json',
      'tarrasch-defense-grunfeld-gambit.json',
      'tarrasch-defense-schara-gambit.json',
      'tarrasch-defense-tarrasch-gambit.json',
      'tarrasch-defense-von-hennig-gambit.json',
      'tarrasch-trap.json',
      'tarrasch-variation-open-system-shaposhnikov-gambit.json',
      'torre-attack-classical-defense-petrosian-gambit.json',
      'torre-attack-wagner-gambit.json',
      'traxler-counterattack-ke2-trap.json',
      'trompowsky-attack-edge-variation-hergert-gambit.json',
      'trompowsky-attack-raptor-variation-hergert-gambit.json',
      'two-knights-defense-ulvestad-variation-kurkin-gambit.json',
      'van-geet-opening-berlin-gambit.json',
      'van-geet-opening-dougherty-gambit.json',
      'van-geet-opening-hector-gambit.json',
      'van-geet-opening-laroche-gambit.json',
      'van-geet-opening-sleipnir-gambit.json',
      'vant-kruijs-opening-keoni-hiva-gambit-akahi-variation.json',
      'vant-kruijs-opening-keoni-hiva-gambit-alua-variation.json',
      'vienna-gambit-with-max-lange-defense-knight-variation.json',
      'vienna-gambit-with-max-lange-defense-pierce-gambit.json',
      'vienna-gambit-with-max-lange-defense.json',
      'vienna-game-adams-gambit.json',
      'vienna-game-frankenstein-dracula-qd5-trap.json',
      'vienna-game-frankenstein-dracula-variation.json',
      'vienna-game-fyfe-gambit.json',
      'vienna-game-omaha-gambit.json',
      'vienna-game-philidor-countergambit.json',
      'vienna-game-vienna-gambit-steinitz-variation.json',
      'vienna-game-vienna-gambit.json',
      'vienna-game-wurzburger-trap.json',
      'ware-opening-ware-gambit.json',
      'ware-opening-wing-gambit.json',
      'zukertort-opening-herrstrom-gambit.json',
      'zukertort-opening-lemberger-gambit.json',
      'zukertort-opening-lisitsyn-gambit.json',
      'zukertort-opening-ross-gambit.json',
      'zukertort-opening-shabalov-gambit.json',
      'zukertort-opening-tennison-gambit-briggs-trap.json',
      'zukertort-opening-tennison-gambit.json',
      'zukertort-opening-vos-gambit.json',
    ])
    const json = readFileSync(join(out, 'damiano-defence-refutation.json'), 'utf8')
    expect(json).not.toContain('\n')
    expect(json).toContain('"tier":"taught"')
  })

  /**
   * The acceptance criterion in one test: the compile fails if validation fails. `npm run
   * build` runs this first and chains with `&&`, so this exit code is what stops a broken
   * entry from reaching a browser.
   */
  it('fails, and writes nothing, when an entry does not pass the gate', () => {
    const source = scratch()
    const out = scratch()
    copyFileSync(
      join(root, 'tools/content/fixtures/invalid/false-mate-claim.yaml'),
      join(source, 'broken.yaml'),
    )
    const result = run('compile-cli.ts', '--source', source, '--out', out)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Nothing was compiled')
    expect(readdirSync(out)).toStrictEqual([])
  })

  it('removes a stale file for an entry that no longer exists', () => {
    const out = scratch()
    writeFileSync(join(out, 'deleted-gambit.json'), '{}')
    run('compile-cli.ts', '--out', out)

    expect(readdirSync(out)).not.toContain('deleted-gambit.json')
  })

  /** Deleting a directory a flag pointed at is worth one look first. */
  it('refuses to clear an output directory holding anything it did not write', () => {
    const out = scratch()
    writeFileSync(join(out, 'important.txt'), 'not mine')
    const result = run('compile-cli.ts', '--out', out)

    expect(result.status).toBe(1)
    expect(existsSync(join(out, 'important.txt'))).toBe(true)
  })
})
