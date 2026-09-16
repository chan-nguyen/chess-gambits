import { describe, expect, it } from 'vitest'
import { foldByName, readDataset, readDatasetSource, replayLine } from './dataset.ts'
import { makeWorkspace } from './fixture-workspace.ts'

/**
 * AC 1. The import reads the dataset and nothing else — and it replays every line rather
 * than trusting it, because a catalogue that shows moves nobody can play is worse than one
 * that is missing them.
 */

const row = (name: string, line: string) => ({
  eco: 'A00',
  name,
  line: line.split(' '),
  where: 'x',
})

describe('reading the vendored dataset', () => {
  it('reads name, ECO and defining line, in canonical SAN', () => {
    const workspace = makeWorkspace()
    const result = readDataset(workspace.datasetDir)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const evans = result.value.find((entry) => entry.name === 'Italian Game: Evans Gambit')
    expect(evans?.eco).toBe('C51')
    expect(evans?.line).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'b4'])
  })

  it('records which snapshot it read, so a stale deploy is diagnosable', () => {
    const workspace = makeWorkspace()
    const source = readDatasetSource(workspace.datasetDir)
    expect(source.ok).toBe(true)
    if (source.ok) expect(source.value.commit).toHaveLength(40)
  })

  it('refuses a row whose moves are not legal, naming the file and the line', () => {
    const workspace = makeWorkspace()
    workspace.edit('dataset/c.tsv', (text) => text.replace('1. e4 e5 2. f4', '1. e4 e5 2. Qh9'))

    const result = readDataset(workspace.datasetDir)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues[0]?.where).toMatch(/c\.tsv:2$/)
    expect(result.issues[0]?.message).toContain('not legal')
  })

  it('refuses a malformed row rather than importing two of its three columns', () => {
    const workspace = makeWorkspace()
    workspace.edit('dataset/a.tsv', (text) => `${text}A00\tOnly two columns\n`)

    const result = readDataset(workspace.datasetDir)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues[0]?.message).toContain('three tab-separated columns')
  })

  it('refuses an empty dataset, because nothing checked is not everything passing', () => {
    const workspace = makeWorkspace()
    for (const file of ['a', 'b', 'c', 'd', 'e']) {
      workspace.write(`dataset/${file}.tsv`, 'eco\tname\tpgn\n')
    }

    const result = readDataset(workspace.datasetDir)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues[0]?.message).toContain('no rows were read')
  })
})

describe('folding rows by name', () => {
  /**
   * The dataset carries 3810 rows under 3174 names — "Italian Game: Evans Gambit" alone
   * appears 41 times, each a deeper line of the same opening. One entry per row would
   * publish 41 identically named entries.
   */
  it('keeps one row per name, and keeps the shortest line', () => {
    const folded = foldByName([
      row('Evans', 'e4 e5 Nf3 Nc6'),
      row('Evans', 'e4 e5'),
      row('Benko', 'd4'),
    ])

    expect(folded.map((entry) => entry.name)).toEqual(['Benko', 'Evans'])
    expect(folded.find((entry) => entry.name === 'Evans')?.line).toEqual(['e4', 'e5'])
  })

  it('breaks a tie on the line itself, so two machines fold the same way', () => {
    const forwards = foldByName([row('Same', 'b3'), row('Same', 'a3')])
    const backwards = foldByName([row('Same', 'a3'), row('Same', 'b3')])
    expect(forwards).toEqual(backwards)
  })
})

describe('replaying a line', () => {
  it('reports whose turn it is, which is what invariant 5 turns on', () => {
    expect(replayLine(['e4', 'e5', 'Nf3'])?.sideToMove).toBe('black')
    expect(replayLine(['e4', 'e5'])?.sideToMove).toBe('white')
  })

  it('returns nothing for an illegal move rather than stopping where it got to', () => {
    expect(replayLine(['e4', 'e5', 'Ke2', 'Ke7', 'Ke1', 'Ke8', 'Kd8'])).toBeUndefined()
  })
})
