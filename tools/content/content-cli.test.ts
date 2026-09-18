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
        'benko-gambit, benko-gambit-accepted, ' +
        'benko-gambit-declined-bishop-attack, benko-gambit-fianchetto-variation, ' +
        'benoni-defense-benoni-gambit-accepted, bird-opening-froms-gambit, ' +
        'bishops-opening-calabrese-countergambit, blackmar-diemer-gambit, ' +
        'blackmar-diemer-gambit-accepted, ' +
        'blackmar-diemer-gambit-declined-brombacher-countergambit, ' +
        'blumenfeld-countergambit, borg-defense-borg-gambit, ' +
        'caro-kann-defense-labahn-attack-double-gambit, ' +
        'center-game-halasz-mcdonnell-gambit, damiano-defence-refutation, ' +
        'danish-gambit, danish-gambit-accepted, dutch-defense-krejcik-gambit, ' +
        'elephant-gambit, elephant-trap, english-opening-jaenisch-gambit, ' +
        'englund-gambit, englund-gambit-declined, englund-gambit-trap, ' +
        'fishing-pole-trap, four-knights-game-halloween-gambit, ' +
        'french-defense-banzai-leong-gambit, grob-opening-alessi-gambit, ' +
        'halosar-trap, hungarian-opening-van-kuijk-gambit, ' +
        'indian-defense-budapest-gambit, ' +
        'indian-defense-gibbins-weidenhagen-gambit, ' +
        'italian-game-blackburne-kostic-gambit, italian-game-evans-gambit, ' +
        'kieninger-trap, kings-gambit, kings-gambit-accepted, ' +
        'kings-gambit-declined-classical-variation, ' +
        'kings-indian-defense-samisch-variation-samisch-gambit, ' +
        'kings-pawn-game-bavarian-gambit, lasker-trap, latvian-gambit, ' +
        'latvian-gambit-accepted, legals-mate, ' +
        'modern-defense-lizard-defense-pirc-diemer-gambit, mortimer-trap, ' +
        'nimzo-indian-defense-dilworth-gambit, ' +
        'nimzowitsch-defense-wheeler-gambit, noahs-ark-trap, ' +
        'owen-defense-naselwaus-gambit, petrovs-defense-stafford-gambit, ' +
        'philidor-defense-lopez-countergambit, polish-opening-birmingham-gambit, ' +
        'ponziani-opening-ponziani-countergambit, ' +
        'queens-gambit-declined-albin-countergambit, ' +
        'queens-pawn-game-zurich-gambit, reti-opening-zilbermints-gambit, ' +
        'ruy-lopez-schliemann-defense, scandinavian-defense-zilbermints-gambit, ' +
        'scotch-game-goring-gambit, scotch-game-scotch-gambit, ' +
        'semi-slav-defense-marshall-gambit, siberian-trap, ' +
        'sicilian-defense-smith-morra-gambit, slav-defense-diemer-gambit, ' +
        'tarrasch-defense-schara-gambit, van-geet-opening-laroche-gambit, ' +
        'vienna-gambit-with-max-lange-defense, vienna-game-fyfe-gambit, ' +
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
      'blumenfeld-countergambit.json',
      'borg-defense-borg-gambit.json',
      'caro-kann-defense-labahn-attack-double-gambit.json',
      'center-game-halasz-mcdonnell-gambit.json',
      'damiano-defence-refutation.json',
      'danish-gambit-accepted.json',
      'danish-gambit.json',
      'dutch-defense-krejcik-gambit.json',
      'elephant-gambit.json',
      'elephant-trap.json',
      'english-opening-jaenisch-gambit.json',
      'englund-gambit-declined.json',
      'englund-gambit-trap.json',
      'englund-gambit.json',
      'fishing-pole-trap.json',
      'four-knights-game-halloween-gambit.json',
      'french-defense-banzai-leong-gambit.json',
      'grob-opening-alessi-gambit.json',
      'halosar-trap.json',
      'hungarian-opening-van-kuijk-gambit.json',
      'indian-defense-budapest-gambit.json',
      'indian-defense-gibbins-weidenhagen-gambit.json',
      'italian-game-blackburne-kostic-gambit.json',
      'italian-game-evans-gambit.json',
      'kieninger-trap.json',
      'kings-gambit-accepted.json',
      'kings-gambit-declined-classical-variation.json',
      'kings-gambit.json',
      'kings-indian-defense-samisch-variation-samisch-gambit.json',
      'kings-pawn-game-bavarian-gambit.json',
      'lasker-trap.json',
      'latvian-gambit-accepted.json',
      'latvian-gambit.json',
      'legals-mate.json',
      'modern-defense-lizard-defense-pirc-diemer-gambit.json',
      'mortimer-trap.json',
      'nimzo-indian-defense-dilworth-gambit.json',
      'nimzowitsch-defense-wheeler-gambit.json',
      'noahs-ark-trap.json',
      'owen-defense-naselwaus-gambit.json',
      'petrovs-defense-stafford-gambit.json',
      'philidor-defense-lopez-countergambit.json',
      'polish-opening-birmingham-gambit.json',
      'ponziani-opening-ponziani-countergambit.json',
      'queens-gambit-declined-albin-countergambit.json',
      'queens-pawn-game-zurich-gambit.json',
      'reti-opening-zilbermints-gambit.json',
      'ruy-lopez-schliemann-defense.json',
      'scandinavian-defense-zilbermints-gambit.json',
      'scotch-game-goring-gambit.json',
      'scotch-game-scotch-gambit.json',
      'semi-slav-defense-marshall-gambit.json',
      'siberian-trap.json',
      'sicilian-defense-smith-morra-gambit.json',
      'slav-defense-diemer-gambit.json',
      'tarrasch-defense-schara-gambit.json',
      'van-geet-opening-laroche-gambit.json',
      'vienna-gambit-with-max-lange-defense.json',
      'vienna-game-fyfe-gambit.json',
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
