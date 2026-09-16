import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'

/**
 * `npm run catalogue:fetch` — refresh the vendored dataset snapshot.
 *
 * A maintainer's command, never part of a build. The snapshot is committed so that the
 * build is reproducible and offline, and so that the "every gambit-named row has a written
 * decision" gate in `classification.yaml` fires when a human deliberately updates the data
 * rather than on an unrelated pull request (`tools/catalogue/dataset/README.md`).
 *
 * It records the upstream commit and a SHA-256 of every file, so the diff says exactly
 * what moved. Expect the classification gate to fail straight afterwards if upstream added
 * gambit-named rows: that is the gate doing its job, and the fix is a rule each.
 */

const REPOSITORY = 'https://github.com/lichess-org/chess-openings'
const API = 'https://api.github.com/repos/lichess-org/chess-openings/commits/master'
const RAW = 'https://raw.githubusercontent.com/lichess-org/chess-openings'
const FILES: readonly string[] = ['a.tsv', 'b.tsv', 'c.tsv', 'd.tsv', 'e.tsv']

const DEFAULT_DIR = join('tools', 'catalogue', 'dataset')

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const headCommit = async (): Promise<{ sha: string; date: string } | undefined> => {
  const response = await fetch(API, { headers: { accept: 'application/vnd.github+json' } })
  if (!response.ok) return undefined
  const body: unknown = await response.json()
  if (!isRecord(body) || typeof body.sha !== 'string') return undefined
  const commit = body.commit
  const committer = isRecord(commit) ? commit.committer : undefined
  const date = isRecord(committer) && typeof committer.date === 'string' ? committer.date : ''
  return { sha: body.sha, date }
}

const today = (): string => new Date().toISOString().slice(0, 10)

const main = async (argv: readonly string[]): Promise<number> => {
  let values
  try {
    ;({ values } = parseArgs({ args: [...argv], options: { dir: { type: 'string' } } }))
  } catch (error) {
    process.stderr.write(
      `catalogue:fetch: ${error instanceof Error ? error.message : String(error)}\n`,
    )
    return 1
  }
  const dir = values.dir ?? DEFAULT_DIR

  const head = await headCommit()
  if (head === undefined) {
    process.stderr.write('catalogue:fetch: could not read the upstream commit. Nothing written.\n')
    return 1
  }

  const hashes: Record<string, string> = {}
  const bodies: { file: string; text: string }[] = []
  for (const file of FILES) {
    const response = await fetch(`${RAW}/${head.sha}/${file}`)
    if (!response.ok) {
      process.stderr.write(
        `catalogue:fetch: ${file} answered ${response.status}. Nothing written.\n`,
      )
      return 1
    }
    const text = await response.text()
    bodies.push({ file, text })
    hashes[file] = createHash('sha256').update(text, 'utf8').digest('hex')
  }

  mkdirSync(dir, { recursive: true })
  for (const { file, text } of bodies) writeFileSync(join(dir, file), text, 'utf8')
  writeFileSync(
    join(dir, 'source.json'),
    `${JSON.stringify(
      {
        repository: REPOSITORY,
        commit: head.sha,
        committedAt: head.date,
        fetchedAt: today(),
        licence: 'CC0-1.0',
        files: hashes,
      },
      null,
      2,
    )}\n`,
    'utf8',
  )

  process.stdout.write(
    `Vendored ${FILES.length} files from ${head.sha.slice(0, 10)} into ${dir}/.\n` +
      'Run `npm run catalogue` next: new gambit-named rows fail the classification gate until\n' +
      'someone writes a rule for them, which is the point.\n',
  )
  return 0
}

process.exitCode = await main(process.argv.slice(2))
