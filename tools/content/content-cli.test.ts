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
      'Known ids: alekhine-defense-krejcik-variation-krejcik-gambit, ' +
        'amar-opening-paris-gambit-gent-gambit, barnes-opening-gedult-gambit, benko-gambit, ' +
        'benko-gambit-accepted, benko-gambit-declined-bishop-attack, ' +
        'benko-gambit-fianchetto-variation, benoni-defense-benoni-gambit-accepted, ' +
        'bird-opening-froms-gambit, bishops-opening-calabrese-countergambit, blackmar-diemer-gambit, ' +
        'blackmar-diemer-gambit-accepted, blackmar-diemer-gambit-declined-brombacher-countergambit, ' +
        'blumenfeld-countergambit, blumenfeld-countergambit-accepted, borg-defense-borg-gambit, ' +
        'caro-kann-defense-labahn-attack-double-gambit, carr-defense-zilbermints-gambit, ' +
        'catalan-opening-hungarian-gambit, center-game-halasz-mcdonnell-gambit, ' +
        'damiano-defence-refutation, danish-gambit, danish-gambit-accepted, ' +
        'danish-gambit-declined-sorensen-defense, duras-gambit, dutch-defense-krejcik-gambit, ' +
        'elephant-gambit, elephant-trap, english-defense-eastbourne-gambit, ' +
        'english-opening-jaenisch-gambit, englund-gambit, englund-gambit-declined, ' +
        'englund-gambit-trap, fishing-pole-trap, four-knights-game-halloween-gambit, ' +
        'french-defense-banzai-leong-gambit, grob-opening-alessi-gambit, ' +
        'grunfeld-defense-gibbon-gambit, halosar-trap, horwitz-defense-zilbermints-gambit, ' +
        'hungarian-opening-van-kuijk-gambit, indian-defense-budapest-gambit, ' +
        'indian-defense-gibbins-weidenhagen-gambit, irish-gambit, ' +
        'italian-game-blackburne-kostic-gambit, italian-game-evans-gambit, ' +
        'kadas-opening-schneider-gambit, kieninger-trap, kings-gambit, kings-gambit-accepted, ' +
        'kings-gambit-accepted-basman-gambit, kings-gambit-accepted-bishops-gambit, ' +
        'kings-gambit-accepted-breyer-gambit, kings-gambit-accepted-carrera-gambit, ' +
        'kings-gambit-accepted-dodo-variation, kings-gambit-accepted-eisenberg-variation, ' +
        'kings-gambit-accepted-gaga-gambit, kings-gambit-accepted-kings-knights-gambit, ' +
        'kings-gambit-accepted-mason-keres-gambit, kings-gambit-accepted-orsini-gambit, ' +
        'kings-gambit-accepted-paris-gambit, kings-gambit-accepted-schurig-gambit-with-bb5, ' +
        'kings-gambit-accepted-schurig-gambit-with-bd3, kings-gambit-accepted-stamma-gambit, ' +
        'kings-gambit-accepted-tartakower-gambit, kings-gambit-accepted-tumbleweed, ' +
        'kings-gambit-accepted-villemson-gambit, ' +
        'kings-gambit-declined-classical-variation, kings-indian-attack-omega-delta-gambit, ' +
        'kings-indian-defense-samisch-variation-samisch-gambit, kings-pawn-game-bavarian-gambit, ' +
        'kings-pawn-opening-van-hooydoon-gambit, lasker-trap, latvian-gambit, ' +
        'latvian-gambit-accepted, legals-mate, ' +
        'lion-defense-anti-philidor-lions-cave-lion-claw-gambit, ' +
        'mexican-defense-horsefly-gambit, mikenas-defense-pozarek-gambit, ' +
        'modern-defense-lizard-defense-pirc-diemer-gambit, mortimer-trap, ' +
        'nimzo-indian-defense-dilworth-gambit, nimzo-larsen-attack-norfolk-gambit, ' +
        'nimzowitsch-defense-wheeler-gambit, noahs-ark-trap, old-indian-defense-aged-gibbon-gambit, ' +
        'owen-defense-naselwaus-gambit, petrovs-defense-stafford-gambit, ' +
        'philidor-defense-lopez-countergambit, pirc-defense-roscher-gambit, ' +
        'polish-defense-spassky-gambit-accepted, polish-opening-birmingham-gambit, ' +
        'ponziani-opening-ponziani-countergambit, portuguese-opening-miguel-gambit, ' +
        'queens-gambit-declined-albin-countergambit, ' +
        'queens-indian-defense-classical-variation-polugaevsky-gambit, ' +
        'queens-pawn-game-zurich-gambit, rat-defense-english-rat-lisbon-gambit, ' +
        'reti-opening-zilbermints-gambit, richter-veresov-attack-malich-gambit, ' +
        'ruy-lopez-schliemann-defense, ' +
        'scandinavian-defense-zilbermints-gambit, scotch-game-goring-gambit, ' +
        'scotch-game-scotch-gambit, semi-slav-defense-marshall-gambit, siberian-trap, ' +
        'sicilian-defense-brussels-gambit, sicilian-defense-euwe-attack-prins-gambit, ' +
        'sicilian-defense-halasz-gambit, sicilian-defense-morphy-gambit, ' +
        'sicilian-defense-okelly-variation-wing-gambit, sicilian-defense-polish-gambit, ' +
        'sicilian-defense-portsmouth-gambit, sicilian-defense-smith-morra-gambit, ' +
        'sicilian-defense-wing-gambit, slav-defense-diemer-gambit, ' +
        'sodium-attack-durkin-gambit, st-george-defense-zilbermints-gambit, ' +
        'tarrasch-defense-schara-gambit, torre-attack-wagner-gambit, ' +
        'trompowsky-attack-raptor-variation-hergert-gambit, van-geet-opening-laroche-gambit, ' +
        'vant-kruijs-opening-keoni-hiva-gambit-akahi-variation, ' +
        'vienna-gambit-with-max-lange-defense, vienna-game-fyfe-gambit, ware-opening-wing-gambit, ' +
        'zukertort-opening-herrstrom-gambit.',
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
      'amar-opening-paris-gambit-gent-gambit.json',
      'barnes-opening-gedult-gambit.json',
      'benko-gambit-accepted.json',
      'benko-gambit-declined-bishop-attack.json',
      'benko-gambit-fianchetto-variation.json',
      'benko-gambit.json',
      'benoni-defense-benoni-gambit-accepted.json',
      'bird-opening-froms-gambit.json',
      'bishops-opening-calabrese-countergambit.json',
      'blackmar-diemer-gambit-accepted.json',
      'blackmar-diemer-gambit-declined-brombacher-countergambit.json',
      'blackmar-diemer-gambit.json',
      'blumenfeld-countergambit-accepted.json',
      'blumenfeld-countergambit.json',
      'borg-defense-borg-gambit.json',
      'caro-kann-defense-labahn-attack-double-gambit.json',
      'carr-defense-zilbermints-gambit.json',
      'catalan-opening-hungarian-gambit.json',
      'center-game-halasz-mcdonnell-gambit.json',
      'damiano-defence-refutation.json',
      'danish-gambit-accepted.json',
      'danish-gambit-declined-sorensen-defense.json',
      'danish-gambit.json',
      'duras-gambit.json',
      'dutch-defense-krejcik-gambit.json',
      'elephant-gambit.json',
      'elephant-trap.json',
      'english-defense-eastbourne-gambit.json',
      'english-opening-jaenisch-gambit.json',
      'englund-gambit-declined.json',
      'englund-gambit-trap.json',
      'englund-gambit.json',
      'fishing-pole-trap.json',
      'four-knights-game-halloween-gambit.json',
      'french-defense-banzai-leong-gambit.json',
      'grob-opening-alessi-gambit.json',
      'grunfeld-defense-gibbon-gambit.json',
      'halosar-trap.json',
      'horwitz-defense-zilbermints-gambit.json',
      'hungarian-opening-van-kuijk-gambit.json',
      'indian-defense-budapest-gambit.json',
      'indian-defense-gibbins-weidenhagen-gambit.json',
      'irish-gambit.json',
      'italian-game-blackburne-kostic-gambit.json',
      'italian-game-evans-gambit.json',
      'kadas-opening-schneider-gambit.json',
      'kieninger-trap.json',
      'kings-gambit-accepted-basman-gambit.json',
      'kings-gambit-accepted-bishops-gambit.json',
      'kings-gambit-accepted-breyer-gambit.json',
      'kings-gambit-accepted-carrera-gambit.json',
      'kings-gambit-accepted-dodo-variation.json',
      'kings-gambit-accepted-eisenberg-variation.json',
      'kings-gambit-accepted-gaga-gambit.json',
      'kings-gambit-accepted-kings-knights-gambit.json',
      'kings-gambit-accepted-mason-keres-gambit.json',
      'kings-gambit-accepted-orsini-gambit.json',
      'kings-gambit-accepted-paris-gambit.json',
      'kings-gambit-accepted-schurig-gambit-with-bb5.json',
      'kings-gambit-accepted-schurig-gambit-with-bd3.json',
      'kings-gambit-accepted-stamma-gambit.json',
      'kings-gambit-accepted-tartakower-gambit.json',
      'kings-gambit-accepted-tumbleweed.json',
      'kings-gambit-accepted-villemson-gambit.json',
      'kings-gambit-accepted.json',
      'kings-gambit-declined-classical-variation.json',
      'kings-gambit.json',
      'kings-indian-attack-omega-delta-gambit.json',
      'kings-indian-defense-samisch-variation-samisch-gambit.json',
      'kings-pawn-game-bavarian-gambit.json',
      'kings-pawn-opening-van-hooydoon-gambit.json',
      'lasker-trap.json',
      'latvian-gambit-accepted.json',
      'latvian-gambit.json',
      'legals-mate.json',
      'lion-defense-anti-philidor-lions-cave-lion-claw-gambit.json',
      'mexican-defense-horsefly-gambit.json',
      'mikenas-defense-pozarek-gambit.json',
      'modern-defense-lizard-defense-pirc-diemer-gambit.json',
      'mortimer-trap.json',
      'nimzo-indian-defense-dilworth-gambit.json',
      'nimzo-larsen-attack-norfolk-gambit.json',
      'nimzowitsch-defense-wheeler-gambit.json',
      'noahs-ark-trap.json',
      'old-indian-defense-aged-gibbon-gambit.json',
      'owen-defense-naselwaus-gambit.json',
      'petrovs-defense-stafford-gambit.json',
      'philidor-defense-lopez-countergambit.json',
      'pirc-defense-roscher-gambit.json',
      'polish-defense-spassky-gambit-accepted.json',
      'polish-opening-birmingham-gambit.json',
      'ponziani-opening-ponziani-countergambit.json',
      'portuguese-opening-miguel-gambit.json',
      'queens-gambit-declined-albin-countergambit.json',
      'queens-indian-defense-classical-variation-polugaevsky-gambit.json',
      'queens-pawn-game-zurich-gambit.json',
      'rat-defense-english-rat-lisbon-gambit.json',
      'reti-opening-zilbermints-gambit.json',
      'richter-veresov-attack-malich-gambit.json',
      'ruy-lopez-schliemann-defense.json',
      'scandinavian-defense-zilbermints-gambit.json',
      'scotch-game-goring-gambit.json',
      'scotch-game-scotch-gambit.json',
      'semi-slav-defense-marshall-gambit.json',
      'siberian-trap.json',
      'sicilian-defense-brussels-gambit.json',
      'sicilian-defense-euwe-attack-prins-gambit.json',
      'sicilian-defense-halasz-gambit.json',
      'sicilian-defense-morphy-gambit.json',
      'sicilian-defense-okelly-variation-wing-gambit.json',
      'sicilian-defense-polish-gambit.json',
      'sicilian-defense-portsmouth-gambit.json',
      'sicilian-defense-smith-morra-gambit.json',
      'sicilian-defense-wing-gambit.json',
      'slav-defense-diemer-gambit.json',
      'sodium-attack-durkin-gambit.json',
      'st-george-defense-zilbermints-gambit.json',
      'tarrasch-defense-schara-gambit.json',
      'torre-attack-wagner-gambit.json',
      'trompowsky-attack-raptor-variation-hergert-gambit.json',
      'van-geet-opening-laroche-gambit.json',
      'vant-kruijs-opening-keoni-hiva-gambit-akahi-variation.json',
      'vienna-gambit-with-max-lange-defense.json',
      'vienna-game-fyfe-gambit.json',
      'ware-opening-wing-gambit.json',
      'zukertort-opening-herrstrom-gambit.json',
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
