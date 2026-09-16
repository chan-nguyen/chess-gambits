import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { parseArgs } from 'node:util'
import { Chess } from 'chess.js'
import type { MateClaim } from '../content/validate.ts'
import { certificateJson, countNet } from './certificate.ts'
import { claimsUnder, isProvable } from './corpus.ts'
import { generateCertificate } from './generate.ts'
import type { OracleAnswer } from './oracle.ts'
import { askOracle } from './oracle.ts'
import { DEFAULT_NODE_CAP } from './search.ts'
import { verifyCertificate } from './verify.ts'

/**
 * `npm run prove:mates` — find the mates, expand the nets, write the certificates.
 *
 * **Scheduled, never a merge gate.** It may speak to Stockfish and it may search for
 * minutes; neither belongs on a pull request. What CI runs is `verify:mates`, which replays
 * what this wrote in milliseconds and needs no engine.
 *
 * The order of operations is the point:
 *
 * 1. Read the content and find the leaves marked `type: trap`. A leaf the gate has already
 *    rejected for being unproved is exactly the input here.
 * 2. Ask the oracle how deep the mate might be. With no engine installed it searches to the
 *    maximum depth instead and takes longer — the certificates come out identical, because
 *    nothing the oracle says is believed.
 * 3. Expand the complete net with our own search.
 * 4. **Verify what was just generated, with the same verifier CI uses**, and write nothing
 *    that does not pass. A generator that writes its own output unchecked is a generator
 *    whose bugs become published mate claims.
 *
 * A claim that cannot be proved is refused and the command exits non-zero, naming the leaf.
 * It is never downgraded to an assessment: what the position is worth instead is a
 * judgement, and judgements are the author's to write.
 */

const DEFAULT_TARGETS: readonly string[] = ['content']
const DEFAULT_MAX_MOVES = 4

/** Positions are derived, never stored, so the oracle is handed one built from the moves. */
const fenAfter = (line: readonly string[]): string => {
  const chess = new Chess()
  for (const ply of line) chess.move(ply)
  return chess.fen()
}

const describeOracle = (answer: OracleAnswer): string => {
  switch (answer.kind) {
    case 'mate':
      return `oracle suggests mate in ${answer.inMoves}`
    case 'none':
      return 'oracle saw no mate'
    case 'unavailable':
      return `no oracle (${answer.reason})`
  }
}

type Outcome = 'proved' | 'refused'

const proveOne = async (
  claim: MateClaim,
  directory: string,
  settings: {
    readonly maxMoves: number
    readonly nodeCap: number
    readonly engine: string | undefined
    readonly useEngine: boolean
  },
): Promise<Outcome> => {
  const where = `${claim.entryId} > ${claim.nodePath.join(' > ')}`
  const answer: OracleAnswer = settings.useEngine
    ? await askOracle(fenAfter(claim.line), { binary: settings.engine })
    : { kind: 'unavailable', reason: 'disabled by --no-engine' }
  // The oracle only narrows the search. Believing it would make it an authority, and the
  // whole design turns on it not being one.
  const depth =
    answer.kind === 'mate' ? Math.min(answer.inMoves, settings.maxMoves) : settings.maxMoves
  const hint = describeOracle(answer)

  const started = Date.now()
  const definingLine = claim.line.slice(0, claim.line.length - claim.nodePath.length)
  const generated = generateCertificate(claim.entryId, definingLine, claim.nodePath, {
    maxMoves: depth,
    nodeCap: settings.nodeCap,
  })
  const elapsed = Date.now() - started

  if (!generated.ok) {
    process.stdout.write(
      `REFUSED ${where}  (${hint}, ${elapsed}ms)\n` +
        `  [${generated.reason}] ${generated.message}\n` +
        `  The leaf keeps its claim and the build keeps failing until an author writes what is actually true about the position.\n`,
    )
    return 'refused'
  }

  const verification = verifyCertificate(claim.certificate, generated.certificate, {
    nodeCap: settings.nodeCap,
  })
  if (!verification.ok) {
    process.stdout.write(
      `REFUSED ${where}\n` +
        `  The certificate this command just generated does not verify, so it is a defect in this tool rather than a fact about the position:\n` +
        `    ${verification.failures.map((failure) => failure.message).join('\n    ')}\n`,
    )
    return 'refused'
  }

  const path = join(directory, claim.certificate)
  writeFileSync(path, certificateJson(generated.certificate), 'utf8')
  const counted = countNet(generated.certificate.net)
  process.stdout.write(
    `PROVED  ${where}  mate in ${generated.certificate.inMoves}\n` +
      `  ${path}  (${counted.attackerMoves} attacker moves, ${counted.defenderNodes} defender node(s); ${hint}, ${elapsed}ms)\n` +
      `  longest line: ${verification.proof.sequence.join(' ')}\n`,
  )
  return 'proved'
}

const run = async (argv: readonly string[]): Promise<number> => {
  let values
  let positionals
  try {
    ;({ values, positionals } = parseArgs({
      args: [...argv],
      allowPositionals: true,
      options: {
        'max-moves': { type: 'string' },
        'node-cap': { type: 'string' },
        engine: { type: 'string' },
        'no-engine': { type: 'boolean' },
      },
    }))
  } catch (error) {
    process.stderr.write(`prove:mates: ${error instanceof Error ? error.message : String(error)}\n`)
    return 1
  }

  const targets = positionals.length > 0 ? positionals : DEFAULT_TARGETS
  const settings = {
    maxMoves: Number(values['max-moves'] ?? DEFAULT_MAX_MOVES),
    nodeCap: Number(values['node-cap'] ?? DEFAULT_NODE_CAP),
    engine: values.engine,
    useEngine: values['no-engine'] !== true,
  }

  let files
  try {
    files = claimsUnder(targets)
  } catch {
    process.stderr.write(`prove:mates: cannot read ${targets.join(', ')}\n`)
    return 1
  }

  let proved = 0
  let refused = 0
  let skipped = 0

  for (const file of files) {
    if (file.claims.length === 0) continue
    const unfixable = file.issues.filter((issue) => !isProvable(issue))
    if (unfixable.length > 0) {
      skipped += 1
      process.stdout.write(
        `SKIP    ${file.file}\n  ${unfixable.length} issue(s) a proof cannot fix (${[...new Set(unfixable.map((issue) => issue.code))].join(', ')}). Run \`npm run validate:content\` first.\n`,
      )
      continue
    }
    for (const claim of file.claims) {
      const outcome = await proveOne(claim, dirname(file.file), settings)
      if (outcome === 'proved') proved += 1
      else refused += 1
    }
  }

  if (proved + refused + skipped === 0) {
    process.stdout.write(
      `prove:mates: no leaf under ${targets.join(', ')} is marked \`type: trap\`. Nothing was proved, which is not the same as everything being proved.\n`,
    )
    return 0
  }

  process.stdout.write(`\n${proved} proved, ${refused} refused, ${skipped} file(s) skipped.\n`)
  return refused > 0 || skipped > 0 ? 1 : 0
}

process.exitCode = await run(process.argv.slice(2))
