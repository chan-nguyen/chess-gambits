import { describe, expect, it } from 'vitest'
import { build, collectMintables } from './build.ts'
import { BUDGET_BYTES } from './budget.ts'
import type { Workspace } from './fixture-workspace.ts'
import { makeWorkspace } from './fixture-workspace.ts'
import { freeze, mintedId } from './ids.ts'
import { readFrozenIds, serialiseFrozenIds } from './source.ts'

/**
 * The gates, shown failing.
 *
 * A gate that has only ever been seen passing is a comment. Each case here breaks exactly
 * one thing in a working fixture and asserts the build refuses it, by the message a
 * maintainer would have to act on.
 *
 * The three the ticket names are first: a renamed dataset entry that would change an id, a
 * previously published id that disappears, and a payload over budget.
 */

const messages = (workspace: Workspace, options: { content?: boolean } = {}): string => {
  const result = build({
    datasetDir: workspace.datasetDir,
    sourceDir: workspace.sourceDir,
    ...(options.content === false ? {} : { contentDir: workspace.contentDir }),
  })
  expect(result.ok).toBe(false)
  return result.ok
    ? ''
    : result.issues.map((issue) => `${issue.where}: ${issue.message}`).join('\n')
}

const built = (workspace: Workspace) => {
  const result = build({
    datasetDir: workspace.datasetDir,
    sourceDir: workspace.sourceDir,
    contentDir: workspace.contentDir,
  })
  if (!result.ok) {
    throw new Error(result.issues.map((issue) => `${issue.where}: ${issue.message}`).join('\n'))
  }
  return result.value
}

/** Refreeze whatever the workspace currently describes. Used by the over-budget case. */
const refreeze = (workspace: Workspace): void => {
  const mintables = collectMintables({
    datasetDir: workspace.datasetDir,
    sourceDir: workspace.sourceDir,
  })
  const existing = readFrozenIds(workspace.sourceDir)
  if (!mintables.ok || !existing.ok) throw new Error('fixture could not be frozen')
  workspace.write('source/ids.json', serialiseFrozenIds(freeze(existing.value, mintables.value)))
}

describe('a dataset entry renamed upstream', () => {
  const rename = (workspace: Workspace, to: string): void => {
    workspace.edit('dataset/c.tsv', (text) => text.replaceAll('Italian Game: Evans Gambit', to))
  }

  it('keeps its id and takes the new name as its display name', () => {
    const workspace = makeWorkspace()
    rename(workspace, 'Italian Game: The Evans Gambit')

    const result = built(workspace)
    const evans = result.records.find((entry) => entry.id === 'italian-game-evans-gambit')
    expect(evans?.name).toBe('Italian Game: The Evans Gambit')
    expect(result.renamed.map((change) => change.id)).toContain('italian-game-evans-gambit')
  })

  /**
   * And the half that shows the freeze is load-bearing. Regenerating the id from the new
   * name produces a different slug, and the URL that has been shared stops resolving.
   */
  it('would have changed the id if the id came from the name', () => {
    expect(mintedId('Italian Game: The Evans Gambit')).not.toBe('italian-game-evans-gambit')
  })

  /**
   * The rename that is not a rename: upstream drops the word "Gambit" from the name, the
   * curated rule stops admitting the row, and the entry leaves the catalogue. Two gates
   * fire rather than none, which is the difference between noticing and not.
   */
  it('fails when the new name no longer says Gambit and the entry falls out', () => {
    const workspace = makeWorkspace()
    rename(workspace, 'Italian Game: Evans Attack')

    const text = messages(workspace)
    expect(text).toContain('contribute no entry')
    expect(text).toContain('italian-game-evans-gambit')
  })

  it('fails when the rename moves the line as well, rather than guessing', () => {
    const workspace = makeWorkspace()
    rename(workspace, 'Italian Game: The Evans Gambit')
    workspace.edit('dataset/c.tsv', (text) =>
      text.replace('3. Bc4 Bc5 4. b4\n', '3. Bc4 Bc5 4. b4 Bxb4\n'),
    )

    expect(messages(workspace)).toContain('previously published id')
  })
})

describe('a previously published id that disappears', () => {
  it('fails the build, naming the id and what breaks', () => {
    const workspace = makeWorkspace()
    workspace.edit('dataset/c.tsv', (text) =>
      text
        .split('\n')
        .filter((line) => !line.includes('Evans Gambit, Main Line'))
        .join('\n'),
    )

    const text = messages(workspace)
    expect(text).toContain('italian-game-evans-gambit-main-line')
    expect(text).toContain('would now 404')
    expect(text).toContain('invariant 9')
  })

  it('fails when a hand-curated trap is dropped from its source file', () => {
    const workspace = makeWorkspace()
    workspace.edit('source/traps.yaml', (text) => `${text.split('traps:')[0] ?? ''}traps: []\n`)

    expect(messages(workspace)).toContain('legals-mate')
  })
})

describe('a payload over budget', () => {
  /**
   * Distinct legal lines, cheaply: four white pawn moves on a-d and four black pawn moves
   * on e-h, in every order and at either length. No two pawns can interact, so every
   * combination is legal, and the sequence identifies the combination.
   */
  const permutations = (files: readonly string[]): readonly (readonly string[])[] =>
    files.length <= 1
      ? [files]
      : files.flatMap((file, index) =>
          permutations([...files.slice(0, index), ...files.slice(index + 1)]).map((rest) => [
            file,
            ...rest,
          ]),
        )

  const whiteOrders = permutations(['a', 'b', 'c', 'd'])
  const blackOrders = permutations(['e', 'f', 'g', 'h'])

  const line = (index: number): string => {
    const white = whiteOrders[index % 24] ?? []
    const black = blackOrders[Math.floor(index / 384) % 24] ?? []
    const whiteSteps = Math.floor(index / 24) % 16
    const blackSteps = Math.floor(index / 9216) % 16
    const moves = white.flatMap((file, ply) => [
      `${file}${((whiteSteps >> ply) & 1) === 1 ? '4' : '3'}`,
      `${black[ply] ?? 'e'}${((blackSteps >> ply) & 1) === 1 ? '5' : '6'}`,
    ])
    return moves.map((move, ply) => (ply % 2 === 0 ? `${ply / 2 + 1}. ${move}` : move)).join(' ')
  }

  /** Comfortably past 100KB gzipped, and small enough that the test stays a few seconds. */
  const ENTRIES = 10_000

  it('fails the build, over the whole generated file rather than a sample', () => {
    const workspace = makeWorkspace()
    const rows = Array.from(
      { length: ENTRIES },
      (_, index) =>
        `A00\tSynthetic Opening ${index % 40}: Variation ${index} Gambit\t${line(index)}`,
    )
    workspace.write('dataset/a.tsv', `eco\tname\tpgn\n${rows.join('\n')}\n`)
    for (const file of ['b', 'c', 'd', 'e']) {
      workspace.write(`dataset/${file}.tsv`, 'eco\tname\tpgn\n')
    }
    workspace.write(
      'source/classification.yaml',
      [
        'reviewedBy: fixture',
        "reviewedAt: '2026-01-01'",
        'basis: a fixture classification, long enough to be a reason',
        'rules:',
        "  - match: 'Synthetic Opening'",
        '    include: true',
        '    side: white',
        '    soundness: dubious',
        '    reason: a fixture rule, long enough to be a reason',
      ].join('\n'),
    )
    refreeze(workspace)

    const text = messages(workspace, { content: false })
    expect(text).toContain('above the 100.0KB catalogue budget')
    expect(text).toContain('catalogue.vi.json')
    expect(text).toContain('does not scale with coverage')
  }, 60_000)

  it('states the budget the design system states', () => {
    expect(BUDGET_BYTES).toBe(102_400)
  })
})

describe('an entry with no frozen id', () => {
  it('is refused rather than given one at build time', () => {
    const workspace = makeWorkspace()
    workspace.edit(
      'dataset/a.tsv',
      (text) => `${text}A57\tBenko Gambit, Zaitsev System\t1. d4 Nf6 2. c4 c5 3. d5 b5 4. Nc3\n`,
    )

    const text = messages(workspace)
    expect(text).toContain('no frozen id')
    expect(text).toContain('catalogue:freeze')
  })
})

describe('the ECO check, and the exemption traps have from it', () => {
  it('fails an authored gambit whose ECO disagrees with the dataset', () => {
    const workspace = makeWorkspace()
    workspace.edit('content/evans-gambit.yaml', (text) => text.replace('eco: C51', 'eco: C44'))

    const text = messages(workspace)
    expect(text).toContain('has ECO `C44` and the dataset gives `C51`')
    expect(text).toContain('Traps are exempt')
  })

  /**
   * AC 4. A trap line resolves to whatever opening it sits inside — Légal's Mate is a
   * Philidor by one move order and an Italian by another — so the check would compare a
   * trap against an opening and be satisfied by the wrong answer.
   */
  it('does not run for a trap, whose ECO is hand-entered', () => {
    const workspace = makeWorkspace()
    workspace.write(
      'content/legals-mate.yaml',
      [
        '# Fixture. `eco: C50` disagrees with the C41 in `traps.yaml` on purpose: a trap',
        '# position genuinely carries two codes depending on the move order that reached it,',
        '# which is why its ECO is a judgement rather than a lookup.',
        'id: legals-mate',
        'name: "Légal\'s Mate"',
        'eco: C50',
        'category: trap',
        'side: white',
        'definingLine: [e4, e5, Nf3, d6, Bc4, Bg4, Nc3]',
        'soundness:',
        '  value: sound',
        "  reviewedAt: '2026-01-01'",
        '  basis:',
        '    by: fixture-author',
        "    at: '2026-01-01'",
        "    source: 'Author impression; no engine and no published source.'",
        'judgement:',
        '  by: fixture-author',
        "  at: '2026-01-01'",
        'tree:',
        '  annotation:',
        '    vi: Bẫy chiếu hết Légal. Nhánh cây chưa được dựng.',
        '  outcome:',
        '    type: unexplored',
        '',
      ].join('\n'),
    )

    expect(built(workspace).records.find((entry) => entry.id === 'legals-mate')?.eco).toBe('C41')
  })
})

describe('a hand-entered trap line', () => {
  it('is refused when it is not legal', () => {
    const workspace = makeWorkspace()
    workspace.edit('source/traps.yaml', (text) => text.replace('Bg4, Nc3]', 'Bg4, Nc9]'))
    expect(messages(workspace)).toMatch(/is not a SAN move|not a legal sequence/)
  })

  it('is refused when it leaves the learner to move, which invariant 5 forbids', () => {
    const workspace = makeWorkspace()
    workspace.edit('source/traps.yaml', (text) => text.replace('Bg4, Nc3]', 'Bg4]'))

    const text = messages(workspace)
    expect(text).toContain('invariant 5')
    expect(text).toContain('leaves white to move')
  })

  it('is refused when it is spelt in something other than canonical SAN', () => {
    const workspace = makeWorkspace()
    workspace.edit('source/traps.yaml', (text) => text.replace('[e4, e5,', '[e2e4, e5,'))
    expect(messages(workspace)).toMatch(/is not a SAN move|canonical SAN/)
  })
})

describe('an authored entry that no catalogue source file carries', () => {
  it('is refused, because nothing would ever link to it', () => {
    const workspace = makeWorkspace()
    workspace.edit('content/evans-gambit.yaml', (text) =>
      text.replace('id: italian-game-evans-gambit', 'id: some-unlisted-gambit'),
    )

    const text = messages(workspace)
    expect(text).toContain('is not in the catalogue')
    expect(text).toContain('traps.yaml')
  })
})

describe('a curated rule with no reason', () => {
  it('is refused, because a rule without one is not a reviewed decision', () => {
    const workspace = makeWorkspace()
    workspace.edit('source/classification.yaml', (text) =>
      text.replace('reason: >-', 'reason: TODO'),
    )
    expect(messages(workspace)).toMatch(/placeholder|must say why/)
  })
})

describe('a tier written into a source file', () => {
  /**
   * AC 7. A tier is a claim about the content and content is the only thing entitled to
   * make it (docs/CONTEXT.md, invariant 8). Every curated schema here is strict, so the
   * refusal is "unrecognised key" rather than a tier that quietly overrides the derived one.
   */
  it('is refused, in the trap file', () => {
    const workspace = makeWorkspace()
    workspace.edit('source/traps.yaml', (text) =>
      text.replace('    eco: C41', '    eco: C41\n    tier: taught'),
    )
    expect(messages(workspace)).toMatch(/tier/)
  })

  it('is refused, in the classification file', () => {
    const workspace = makeWorkspace()
    workspace.edit('source/classification.yaml', (text) =>
      text.replace("  - match: 'Benko Gambit'", "  - match: 'Benko Gambit'\n    tier: taught"),
    )
    expect(messages(workspace)).toMatch(/tier/)
  })
})

describe('two entries on one defining line', () => {
  /**
   * Reached by accident rather than by malice: a hand-curated trap whose line is the same
   * position the dataset already names a gambit. The Blackburne Shilling Trap is exactly
   * this, which is why `traps.yaml` does not carry it.
   */
  const collide = (workspace: Workspace): void => {
    workspace.edit('source/traps.yaml', (text) =>
      text.replace(
        '    line: [e4, e5, Nf3, d6, Bc4, Bg4, Nc3]',
        '    line: [e4, e5, Nf3, Nc6, Bc4, Bc5, b4]',
      ),
    )
  }

  it('is refused, naming both entries and the line they share', () => {
    const workspace = makeWorkspace()
    collide(workspace)
    // The real case, spelt out: a trap whose name sorts before the gambit's, frozen from
    // nothing, so the trap's id wins the shared line and both entries resolve to it.
    workspace.edit('source/traps.yaml', (text) =>
      text
        .replace('id: legals-mate', 'id: blackburne-shilling-trap')
        .replace('name: "Légal\'s Mate"', "name: 'Blackburne Shilling Trap'"),
    )
    workspace.write('source/ids.json', '{ "note": "fixture", "entries": {} }')
    refreeze(workspace)

    const text = messages(workspace, { content: false })
    expect(text).toContain('share the defining line')
    expect(text).toContain('Italian Game: Evans Gambit')
  })

  it('is refused when the line already belongs to a published id', () => {
    const workspace = makeWorkspace()
    collide(workspace)

    const text = messages(workspace)
    expect(text).toContain('is frozen as `italian-game-evans-gambit`')
    expect(text).toContain('invariant 9')
  })
})
