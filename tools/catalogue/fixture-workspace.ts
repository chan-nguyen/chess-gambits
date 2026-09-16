import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * A throwaway copy of `tools/catalogue/fixtures/`, for tests that need to break one thing.
 *
 * The adversarial cases in this tool are all *mutations of a working input* — a renamed
 * row, a deleted row, a payload one entry too large — and three near-identical fixture
 * directories on disk would hide which byte differs. One committed fixture plus a named
 * mutation in the test says it out loud.
 *
 * Test-only. Nothing in the build imports this.
 */

export type Workspace = {
  readonly datasetDir: string
  readonly sourceDir: string
  readonly contentDir: string
  /** Rewrite a file inside the copy, e.g. `edit('dataset/c.tsv', (text) => …)`. */
  readonly edit: (relativePath: string, change: (text: string) => string) => void
  readonly read: (relativePath: string) => string
  readonly write: (relativePath: string, text: string) => void
}

export const makeWorkspace = (): Workspace => {
  const root = mkdtempSync(join(tmpdir(), 'chess-gambits-catalogue-'))
  cpSync(join('tools', 'catalogue', 'fixtures'), root, { recursive: true })

  const read = (relativePath: string): string => readFileSync(join(root, relativePath), 'utf8')
  const write = (relativePath: string, text: string): void =>
    writeFileSync(join(root, relativePath), text, 'utf8')

  return {
    datasetDir: join(root, 'dataset'),
    sourceDir: join(root, 'source'),
    contentDir: join(root, 'content'),
    edit: (relativePath, change) => write(relativePath, change(read(relativePath))),
    read,
    write,
  }
}
