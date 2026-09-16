import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, extname, join } from 'node:path'
import { parseArgs } from 'node:util'
import { formatIssues } from './issue.ts'
import { importPgn } from './pgn-import.ts'
import type { Category, Side, SoundnessValue } from './types.ts'
import { validateText } from './validate.ts'

/**
 * `npm run import-pgn -- <file.pgn> --side white --soundness dubious`
 *
 * The one-time door from a board GUI into the repository (ADR-0004). After this the YAML
 * is the source of truth and the PGN is not kept, so the command refuses to overwrite an
 * existing entry: the second import would silently destroy the annotations, assessments
 * and dismissals written since the first.
 *
 * `--side` and `--soundness` have no defaults on purpose. Both are judgements — side
 * decides every derived `kind` in the tree, and soundness is the entry's central honesty
 * claim — and a tool that guesses a judgement is the failure mode this project is about.
 */

const USAGE = `Usage: npm run import-pgn -- <file.pgn> --side <white|black> --soundness <sound|dubious|unsound>

  --side <white|black>        Required. The side the learner plays.
  --soundness <value>         Required. sound | dubious | unsound.
  --id <slug>                 Entry id. Defaults to the PGN file name.
  --out <path>                Where to write. Defaults to content/<id>.yaml.
  --name <text>               Display name. Defaults to the PGN Opening or Event tag.
  --eco <code>                ECO code. Defaults to the PGN ECO tag.
  --author <name>             Who is making these judgements. Defaults to the Annotator tag.
  --category <gambit|trap>    Defaults to gambit.
  --defining-plies <n>        Overrides the derived defining line length.`

const SIDES: readonly Side[] = ['white', 'black']
const CATEGORIES: readonly Category[] = ['gambit', 'trap']
const SOUNDNESS: readonly SoundnessValue[] = ['sound', 'dubious', 'unsound']

const oneOf = <T extends string>(allowed: readonly T[], value: string | undefined): T | undefined =>
  allowed.find((candidate) => candidate === value)

/** A file name becomes a kebab-case slug; the schema rejects anything that is still not one. */
const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const fail = (message: string): number => {
  process.stderr.write(`import-pgn: ${message}\n`)
  return 1
}

const run = (argv: readonly string[]): number => {
  let parsed
  try {
    parsed = parseArgs({
      args: [...argv],
      allowPositionals: true,
      options: {
        out: { type: 'string' },
        id: { type: 'string' },
        name: { type: 'string' },
        eco: { type: 'string' },
        side: { type: 'string' },
        category: { type: 'string' },
        soundness: { type: 'string' },
        author: { type: 'string' },
        'defining-plies': { type: 'string' },
      },
    })
  } catch (error) {
    return fail(`${error instanceof Error ? error.message : String(error)}\n\n${USAGE}`)
  }

  const { values, positionals } = parsed
  const [input, ...extra] = positionals
  if (input === undefined) return fail(`no PGN file given.\n\n${USAGE}`)
  if (extra.length > 0)
    return fail(`one PGN file at a time; got ${positionals.length}.\n\n${USAGE}`)

  const side = oneOf(SIDES, values.side)
  if (side === undefined) {
    return fail(
      '`--side` is required and is white or black. It is the side the learner plays, and it ' +
        'decides which nodes are learner nodes, so it is never guessed (docs/CONTEXT.md).',
    )
  }

  const soundness = oneOf(SOUNDNESS, values.soundness)
  if (soundness === undefined) {
    return fail(
      '`--soundness` is required and is sound, dubious or unsound. Labelling a gambit sound when ' +
        'it is not is the same category of error as a false mate claim (docs/CONTEXT.md, Soundness).',
    )
  }

  const category = oneOf(CATEGORIES, values.category ?? 'gambit')
  if (category === undefined) return fail('`--category` is gambit or trap.')

  const definingPliesText = values['defining-plies']
  const definingPlies = definingPliesText === undefined ? undefined : Number(definingPliesText)
  if (definingPlies !== undefined && (!Number.isInteger(definingPlies) || definingPlies < 1)) {
    return fail('`--defining-plies` is a whole number of plies, at least 1.')
  }

  const id = values.id ?? slugify(basename(input, extname(input)))
  const out = values.out ?? join('content', `${id}.yaml`)

  if (existsSync(out)) {
    return fail(
      `\`${out}\` already exists and will not be overwritten. After the first import the YAML is ` +
        'the source of truth (ADR-0004), and re-importing would discard every annotation, ' +
        'assessment and dismissal written since. Pass `--out` to write somewhere else.',
    )
  }

  let pgn: string
  try {
    pgn = readFileSync(input, 'utf8')
  } catch {
    return fail(`cannot read \`${input}\`.`)
  }

  const result = importPgn(pgn, {
    id,
    name: values.name,
    eco: values.eco,
    side,
    category,
    soundness,
    author: values.author,
    today: new Date().toISOString().slice(0, 10),
    definingPlies,
  })

  if (!result.ok) {
    const where =
      result.problem.at === undefined
        ? input
        : `${input}:${result.problem.at.line}:${result.problem.at.column}`
    return fail(`${where}\n  ${result.problem.message}`)
  }

  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, result.yaml, 'utf8')

  const { summary } = result
  process.stdout.write(
    `Wrote ${out}\n` +
      `  defining line   ${summary.definingLine.join(' ')}\n` +
      `  nodes           ${summary.nodeCount}\n` +
      `  branch points   ${summary.branchPoints}\n` +
      `  annotations     ${summary.annotations}  (PGN comments, kept as the vi locale)\n` +
      `  reply qualities ${summary.qualities}  (from NAGs on the opponent's replies)\n` +
      `  NAGs in comments ${summary.keptNags}  (nowhere in the model to put them)\n`,
  )

  // The import runs the gate over its own output rather than guessing what would satisfy
  // it. Anything listed below is a judgement only the author can make.
  const report = validateText(out, result.yaml)
  if (report.issues.length === 0) {
    process.stdout.write(`\n${out} already passes the content gate.\n`)
    return 0
  }
  process.stdout.write(
    `\nThe skeleton is written, and the content gate rejects it until these are answered.\n` +
      `These are judgements, so the importer does not invent them:\n\n${formatIssues(report.issues)}\n`,
  )
  return 0
}

process.exitCode = run(process.argv.slice(2))
