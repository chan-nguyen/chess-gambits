import { describe, expect, it } from 'vitest'
import compiledTaught from '../../../tools/content/fixtures/compiled/taught-entry.json?raw'
import compiledProvedMate from '../../../tools/content/fixtures/compiled/proved-mate.json?raw'
import { isCompiledEntry } from '../../lib/content.ts'
import type { CompiledEntry } from '../../lib/content-types.ts'
import { parseLine } from '../../lib/line.ts'
import { parsePrelude } from '../../lib/prelude.ts'
import * as learnFixtures from './learn-fixtures.ts'
import * as treeFixtures from './tree-fixtures.ts'
import { walkEntry } from './walk.ts'

/**
 * **Acceptance criterion 3, frozen.** Every URL that worked before #70 resolves to the same
 * position it resolved to then.
 *
 * This is not a restatement of the implementation in test form. The right-hand column was
 * produced by running `origin/main`'s `resolvePath` — the code as it stood before the walk
 * existed — over every `?line=` value that appears anywhere in `e2e/` or `src/`, against
 * every compiled entry the suite has: the seven hand-written fixtures and the two committed
 * compiler outputs. The numbers are transcribed from that run. Nothing regenerates them, and
 * a change that repoints `line` moves one of them and fails here with the FEN it moved to.
 *
 * Why it has to be a frozen table rather than an assertion about the code: the failure #70
 * is built to avoid is *silent*. A `line` counted from the initial position instead of from
 * the gambit root still parses, still resolves, still draws a board — it simply draws a
 * different one, and the old link keeps working while pointing somewhere else. There is no
 * exception to catch and no shape to check. The only thing that can notice is a record of
 * where each link used to land, written down before the change.
 *
 * Note what the values include, because two of them are the sharpest cases in the table:
 *
 * - `e4_e5_Nf3` names three plies that *are* the start of several of these defining lines.
 *   Under the old meaning they are not children of the root, so the page recovers to the
 *   root. Under a `line` that counted from move one they would name a real position three
 *   plies in. Those two answers are different boards, and this row is the difference.
 * - `cxb5+a6` arrives decoded as `cxb5 a6`, one malformed segment, because a raw `+` is the
 *   form encoding for a space. It has always resolved to the root and still must.
 *
 * Each row is walked with **a prelude asked for as well**, which is the other half of the
 * criterion: the rule that `line` wins is what makes an old URL immune to the new parameter,
 * and a rule nobody tried to break is a rule nobody knows is there.
 */

const FIXTURES: Readonly<Record<string, CompiledEntry>> = Object.fromEntries([
  ...Object.entries({ ...learnFixtures, ...treeFixtures }).flatMap(([name, value]) =>
    typeof value === 'object' && value !== null && 'tree' in value ? [[name, value]] : [],
  ),
  ...Object.entries({
    'compiled:taught-entry': compiledTaught,
    'compiled:proved-mate': compiledProvedMate,
  }).map(([name, text]) => {
    const parsed: unknown = JSON.parse(text)
    if (!isCompiledEntry(parsed)) throw new Error(`${name} is not a compiled entry`)
    return [name, parsed]
  }),
])

/** `[entry, the raw `line` value as the browser decodes it, the FEN it resolved to]`. */
const PUBLISHED: readonly (readonly [string, string, string])[] = [
  [
    'BRANCHING_ENTRY',
    'cxb5+a6',
    'r2qkbnr/ppp2ppp/2np4/4N2b/2B1P3/2N4P/PPPP1PP1/R1BQK2R b KQkq - 0 6',
  ],
  ['BRANCHING_ENTRY', 'fxe5', 'r2qkbnr/ppp2ppp/2np4/4N2b/2B1P3/2N4P/PPPP1PP1/R1BQK2R b KQkq - 0 6'],
  ['BRANCHING_ENTRY', 'Bc5', 'r2qkbnr/ppp2ppp/2np4/4N2b/2B1P3/2N4P/PPPP1PP1/R1BQK2R b KQkq - 0 6'],
  ['BRANCHING_ENTRY', 'Bxd1', 'r2qkbnr/ppp2ppp/2np4/4N3/2B1P3/2N4P/PPPP1PP1/R1BbK2R w KQkq - 0 7'],
  [
    'BRANCHING_ENTRY',
    'fxe5_Qh5+_Ke7#_Qxe5+_Kf7_Bc4+',
    'r2qkbnr/ppp2ppp/2np4/4N2b/2B1P3/2N4P/PPPP1PP1/R1BQK2R b KQkq - 0 6',
  ],
  [
    'BRANCHING_ENTRY',
    '<script>alert(1)</script>',
    'r2qkbnr/ppp2ppp/2np4/4N2b/2B1P3/2N4P/PPPP1PP1/R1BQK2R b KQkq - 0 6',
  ],
  [
    'BRANCHING_ENTRY',
    'Bh5_Nxe5',
    'r2qkbnr/ppp2ppp/2np4/4N2b/2B1P3/2N4P/PPPP1PP1/R1BQK2R b KQkq - 0 6',
  ],
  [
    'BRANCHING_ENTRY',
    'e4_e5_not-a-move_Nf3',
    'r2qkbnr/ppp2ppp/2np4/4N2b/2B1P3/2N4P/PPPP1PP1/R1BQK2R b KQkq - 0 6',
  ],
  ['BRANCHING_ENTRY', 'Ba5', 'r2qkbnr/ppp2ppp/2np4/4N2b/2B1P3/2N4P/PPPP1PP1/R1BQK2R b KQkq - 0 6'],
  [
    'BRANCHING_ENTRY',
    'e4_e5_Nf3',
    'r2qkbnr/ppp2ppp/2np4/4N2b/2B1P3/2N4P/PPPP1PP1/R1BQK2R b KQkq - 0 6',
  ],
  [
    'BRANCHING_ENTRY',
    'fxe5_Qh5+',
    'r2qkbnr/ppp2ppp/2np4/4N2b/2B1P3/2N4P/PPPP1PP1/R1BQK2R b KQkq - 0 6',
  ],
  [
    'BRANCHING_ENTRY',
    'Nxe5_Bxd1_Bxf7+_Ke7_Nd5#',
    'r2qkbnr/ppp2ppp/3p4/4n2b/2B1P3/2N4P/PPPP1PP1/R1BQK2R w KQkq - 0 7',
  ],
  ['BRANCHING_ENTRY', 'a6', 'r2qkbnr/ppp2ppp/2np4/4N2b/2B1P3/2N4P/PPPP1PP1/R1BQK2R b KQkq - 0 6'],
  ['BRANCHING_ENTRY', 'Bxb4', 'r2qkbnr/ppp2ppp/2np4/4N2b/2B1P3/2N4P/PPPP1PP1/R1BQK2R b KQkq - 0 6'],
  [
    'BRANCHING_ENTRY',
    'Bxf3_Qxf3',
    'r2qkbnr/ppp2ppp/2np4/4N2b/2B1P3/2N4P/PPPP1PP1/R1BQK2R b KQkq - 0 6',
  ],
  ['BRANCHING_ENTRY', 'Be6', 'r2qkbnr/ppp2ppp/2np4/4N2b/2B1P3/2N4P/PPPP1PP1/R1BQK2R b KQkq - 0 6'],
  ['BRANCHING_ENTRY', '', 'r2qkbnr/ppp2ppp/2np4/4N2b/2B1P3/2N4P/PPPP1PP1/R1BQK2R b KQkq - 0 6'],
  ['EVANS_ENTRY', 'cxb5+a6', 'r1bqk1nr/pppp1ppp/2n5/4p3/1bB1P3/2P2N2/P2P1PPP/RNBQK2R b KQkq - 0 5'],
  ['EVANS_ENTRY', 'fxe5', 'r1bqk1nr/pppp1ppp/2n5/4p3/1bB1P3/2P2N2/P2P1PPP/RNBQK2R b KQkq - 0 5'],
  ['EVANS_ENTRY', 'Bc5', 'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/2P2N2/P2P1PPP/RNBQK2R w KQkq - 1 6'],
  ['EVANS_ENTRY', 'Bxd1', 'r1bqk1nr/pppp1ppp/2n5/4p3/1bB1P3/2P2N2/P2P1PPP/RNBQK2R b KQkq - 0 5'],
  [
    'EVANS_ENTRY',
    'fxe5_Qh5+_Ke7#_Qxe5+_Kf7_Bc4+',
    'r1bqk1nr/pppp1ppp/2n5/4p3/1bB1P3/2P2N2/P2P1PPP/RNBQK2R b KQkq - 0 5',
  ],
  [
    'EVANS_ENTRY',
    '<script>alert(1)</script>',
    'r1bqk1nr/pppp1ppp/2n5/4p3/1bB1P3/2P2N2/P2P1PPP/RNBQK2R b KQkq - 0 5',
  ],
  [
    'EVANS_ENTRY',
    'Bh5_Nxe5',
    'r1bqk1nr/pppp1ppp/2n5/4p3/1bB1P3/2P2N2/P2P1PPP/RNBQK2R b KQkq - 0 5',
  ],
  [
    'EVANS_ENTRY',
    'e4_e5_not-a-move_Nf3',
    'r1bqk1nr/pppp1ppp/2n5/4p3/1bB1P3/2P2N2/P2P1PPP/RNBQK2R b KQkq - 0 5',
  ],
  ['EVANS_ENTRY', 'Ba5', 'r1bqk1nr/pppp1ppp/2n5/b3p3/2B1P3/2P2N2/P2P1PPP/RNBQK2R w KQkq - 1 6'],
  [
    'EVANS_ENTRY',
    'e4_e5_Nf3',
    'r1bqk1nr/pppp1ppp/2n5/4p3/1bB1P3/2P2N2/P2P1PPP/RNBQK2R b KQkq - 0 5',
  ],
  [
    'EVANS_ENTRY',
    'fxe5_Qh5+',
    'r1bqk1nr/pppp1ppp/2n5/4p3/1bB1P3/2P2N2/P2P1PPP/RNBQK2R b KQkq - 0 5',
  ],
  [
    'EVANS_ENTRY',
    'Nxe5_Bxd1_Bxf7+_Ke7_Nd5#',
    'r1bqk1nr/pppp1ppp/2n5/4p3/1bB1P3/2P2N2/P2P1PPP/RNBQK2R b KQkq - 0 5',
  ],
  ['EVANS_ENTRY', 'a6', 'r1bqk1nr/pppp1ppp/2n5/4p3/1bB1P3/2P2N2/P2P1PPP/RNBQK2R b KQkq - 0 5'],
  ['EVANS_ENTRY', 'Bxb4', 'r1bqk1nr/pppp1ppp/2n5/4p3/1bB1P3/2P2N2/P2P1PPP/RNBQK2R b KQkq - 0 5'],
  [
    'EVANS_ENTRY',
    'Bxf3_Qxf3',
    'r1bqk1nr/pppp1ppp/2n5/4p3/1bB1P3/2P2N2/P2P1PPP/RNBQK2R b KQkq - 0 5',
  ],
  ['EVANS_ENTRY', 'Be6', 'r1bqk1nr/pppp1ppp/2n5/4p3/1bB1P3/2P2N2/P2P1PPP/RNBQK2R b KQkq - 0 5'],
  ['EVANS_ENTRY', '', 'r1bqk1nr/pppp1ppp/2n5/4p3/1bB1P3/2P2N2/P2P1PPP/RNBQK2R b KQkq - 0 5'],
  ['MAPPED_ENTRY', 'cxb5+a6', 'rnbqkbnr/pppp2pp/5p2/4N3/4P3/8/PPPP1PPP/RNBQKB1R b KQkq - 0 3'],
  ['MAPPED_ENTRY', 'fxe5', 'rnbqkbnr/pppp2pp/8/4p3/4P3/8/PPPP1PPP/RNBQKB1R w KQkq - 0 4'],
  ['MAPPED_ENTRY', 'Bc5', 'rnbqkbnr/pppp2pp/5p2/4N3/4P3/8/PPPP1PPP/RNBQKB1R b KQkq - 0 3'],
  ['MAPPED_ENTRY', 'Bxd1', 'rnbqkbnr/pppp2pp/5p2/4N3/4P3/8/PPPP1PPP/RNBQKB1R b KQkq - 0 3'],
  [
    'MAPPED_ENTRY',
    'fxe5_Qh5+_Ke7#_Qxe5+_Kf7_Bc4+',
    'rnbqkbnr/pppp2pp/8/4p2Q/4P3/8/PPPP1PPP/RNB1KB1R b KQkq - 1 4',
  ],
  [
    'MAPPED_ENTRY',
    '<script>alert(1)</script>',
    'rnbqkbnr/pppp2pp/5p2/4N3/4P3/8/PPPP1PPP/RNBQKB1R b KQkq - 0 3',
  ],
  ['MAPPED_ENTRY', 'Bh5_Nxe5', 'rnbqkbnr/pppp2pp/5p2/4N3/4P3/8/PPPP1PPP/RNBQKB1R b KQkq - 0 3'],
  [
    'MAPPED_ENTRY',
    'e4_e5_not-a-move_Nf3',
    'rnbqkbnr/pppp2pp/5p2/4N3/4P3/8/PPPP1PPP/RNBQKB1R b KQkq - 0 3',
  ],
  ['MAPPED_ENTRY', 'Ba5', 'rnbqkbnr/pppp2pp/5p2/4N3/4P3/8/PPPP1PPP/RNBQKB1R b KQkq - 0 3'],
  ['MAPPED_ENTRY', 'e4_e5_Nf3', 'rnbqkbnr/pppp2pp/5p2/4N3/4P3/8/PPPP1PPP/RNBQKB1R b KQkq - 0 3'],
  ['MAPPED_ENTRY', 'fxe5_Qh5+', 'rnbqkbnr/pppp2pp/8/4p2Q/4P3/8/PPPP1PPP/RNB1KB1R b KQkq - 1 4'],
  [
    'MAPPED_ENTRY',
    'Nxe5_Bxd1_Bxf7+_Ke7_Nd5#',
    'rnbqkbnr/pppp2pp/5p2/4N3/4P3/8/PPPP1PPP/RNBQKB1R b KQkq - 0 3',
  ],
  ['MAPPED_ENTRY', 'a6', 'rnbqkbnr/pppp2pp/5p2/4N3/4P3/8/PPPP1PPP/RNBQKB1R b KQkq - 0 3'],
  ['MAPPED_ENTRY', 'Bxb4', 'rnbqkbnr/pppp2pp/5p2/4N3/4P3/8/PPPP1PPP/RNBQKB1R b KQkq - 0 3'],
  ['MAPPED_ENTRY', 'Bxf3_Qxf3', 'rnbqkbnr/pppp2pp/5p2/4N3/4P3/8/PPPP1PPP/RNBQKB1R b KQkq - 0 3'],
  ['MAPPED_ENTRY', 'Be6', 'rnbqkbnr/pppp2pp/5p2/4N3/4P3/8/PPPP1PPP/RNBQKB1R b KQkq - 0 3'],
  ['MAPPED_ENTRY', '', 'rnbqkbnr/pppp2pp/5p2/4N3/4P3/8/PPPP1PPP/RNBQKB1R b KQkq - 0 3'],
  [
    'MATE_ENTRY',
    'cxb5+a6',
    'r2qkbnr/ppp2ppp/2np4/4p3/2B1P1b1/2N2N1P/PPPP1PP1/R1BQK2R b KQkq - 0 5',
  ],
  ['MATE_ENTRY', 'fxe5', 'r2qkbnr/ppp2ppp/2np4/4p3/2B1P1b1/2N2N1P/PPPP1PP1/R1BQK2R b KQkq - 0 5'],
  ['MATE_ENTRY', 'Bc5', 'r2qkbnr/ppp2ppp/2np4/4p3/2B1P1b1/2N2N1P/PPPP1PP1/R1BQK2R b KQkq - 0 5'],
  ['MATE_ENTRY', 'Bxd1', 'r2qkbnr/ppp2ppp/2np4/4p3/2B1P1b1/2N2N1P/PPPP1PP1/R1BQK2R b KQkq - 0 5'],
  [
    'MATE_ENTRY',
    'fxe5_Qh5+_Ke7#_Qxe5+_Kf7_Bc4+',
    'r2qkbnr/ppp2ppp/2np4/4p3/2B1P1b1/2N2N1P/PPPP1PP1/R1BQK2R b KQkq - 0 5',
  ],
  [
    'MATE_ENTRY',
    '<script>alert(1)</script>',
    'r2qkbnr/ppp2ppp/2np4/4p3/2B1P1b1/2N2N1P/PPPP1PP1/R1BQK2R b KQkq - 0 5',
  ],
  ['MATE_ENTRY', 'Bh5_Nxe5', 'r2qkbnr/ppp2ppp/2np4/4N2b/2B1P3/2N4P/PPPP1PP1/R1BQK2R b KQkq - 0 6'],
  [
    'MATE_ENTRY',
    'e4_e5_not-a-move_Nf3',
    'r2qkbnr/ppp2ppp/2np4/4p3/2B1P1b1/2N2N1P/PPPP1PP1/R1BQK2R b KQkq - 0 5',
  ],
  ['MATE_ENTRY', 'Ba5', 'r2qkbnr/ppp2ppp/2np4/4p3/2B1P1b1/2N2N1P/PPPP1PP1/R1BQK2R b KQkq - 0 5'],
  [
    'MATE_ENTRY',
    'e4_e5_Nf3',
    'r2qkbnr/ppp2ppp/2np4/4p3/2B1P1b1/2N2N1P/PPPP1PP1/R1BQK2R b KQkq - 0 5',
  ],
  [
    'MATE_ENTRY',
    'fxe5_Qh5+',
    'r2qkbnr/ppp2ppp/2np4/4p3/2B1P1b1/2N2N1P/PPPP1PP1/R1BQK2R b KQkq - 0 5',
  ],
  [
    'MATE_ENTRY',
    'Nxe5_Bxd1_Bxf7+_Ke7_Nd5#',
    'r2qkbnr/ppp2ppp/2np4/4p3/2B1P1b1/2N2N1P/PPPP1PP1/R1BQK2R b KQkq - 0 5',
  ],
  ['MATE_ENTRY', 'a6', 'r2qkbnr/ppp2ppp/2np4/4p3/2B1P1b1/2N2N1P/PPPP1PP1/R1BQK2R b KQkq - 0 5'],
  ['MATE_ENTRY', 'Bxb4', 'r2qkbnr/ppp2ppp/2np4/4p3/2B1P1b1/2N2N1P/PPPP1PP1/R1BQK2R b KQkq - 0 5'],
  [
    'MATE_ENTRY',
    'Bxf3_Qxf3',
    'r2qkbnr/ppp2ppp/2np4/4p3/2B1P1b1/2N2N1P/PPPP1PP1/R1BQK2R b KQkq - 0 5',
  ],
  ['MATE_ENTRY', 'Be6', 'r2qkbnr/ppp2ppp/2np4/4p3/2B1P1b1/2N2N1P/PPPP1PP1/R1BQK2R b KQkq - 0 5'],
  ['MATE_ENTRY', '', 'r2qkbnr/ppp2ppp/2np4/4p3/2B1P1b1/2N2N1P/PPPP1PP1/R1BQK2R b KQkq - 0 5'],
  [
    'OUTCOMES_ENTRY',
    'cxb5+a6',
    'r2qkbnr/ppp2ppp/2np4/4p3/2B1P1b1/2N2N1P/PPPP1PP1/R1BQK2R b KQkq - 0 5',
  ],
  [
    'OUTCOMES_ENTRY',
    'fxe5',
    'r2qkbnr/ppp2ppp/2np4/4p3/2B1P1b1/2N2N1P/PPPP1PP1/R1BQK2R b KQkq - 0 5',
  ],
  [
    'OUTCOMES_ENTRY',
    'Bc5',
    'r2qkbnr/ppp2ppp/2np4/4p3/2B1P1b1/2N2N1P/PPPP1PP1/R1BQK2R b KQkq - 0 5',
  ],
  [
    'OUTCOMES_ENTRY',
    'Bxd1',
    'r2qkbnr/ppp2ppp/2np4/4p3/2B1P1b1/2N2N1P/PPPP1PP1/R1BQK2R b KQkq - 0 5',
  ],
  [
    'OUTCOMES_ENTRY',
    'fxe5_Qh5+_Ke7#_Qxe5+_Kf7_Bc4+',
    'r2qkbnr/ppp2ppp/2np4/4p3/2B1P1b1/2N2N1P/PPPP1PP1/R1BQK2R b KQkq - 0 5',
  ],
  [
    'OUTCOMES_ENTRY',
    '<script>alert(1)</script>',
    'r2qkbnr/ppp2ppp/2np4/4p3/2B1P1b1/2N2N1P/PPPP1PP1/R1BQK2R b KQkq - 0 5',
  ],
  [
    'OUTCOMES_ENTRY',
    'Bh5_Nxe5',
    'r2qkbnr/ppp2ppp/2np4/4N2b/2B1P3/2N4P/PPPP1PP1/R1BQK2R b KQkq - 0 6',
  ],
  [
    'OUTCOMES_ENTRY',
    'e4_e5_not-a-move_Nf3',
    'r2qkbnr/ppp2ppp/2np4/4p3/2B1P1b1/2N2N1P/PPPP1PP1/R1BQK2R b KQkq - 0 5',
  ],
  [
    'OUTCOMES_ENTRY',
    'Ba5',
    'r2qkbnr/ppp2ppp/2np4/4p3/2B1P1b1/2N2N1P/PPPP1PP1/R1BQK2R b KQkq - 0 5',
  ],
  [
    'OUTCOMES_ENTRY',
    'e4_e5_Nf3',
    'r2qkbnr/ppp2ppp/2np4/4p3/2B1P1b1/2N2N1P/PPPP1PP1/R1BQK2R b KQkq - 0 5',
  ],
  [
    'OUTCOMES_ENTRY',
    'fxe5_Qh5+',
    'r2qkbnr/ppp2ppp/2np4/4p3/2B1P1b1/2N2N1P/PPPP1PP1/R1BQK2R b KQkq - 0 5',
  ],
  [
    'OUTCOMES_ENTRY',
    'Nxe5_Bxd1_Bxf7+_Ke7_Nd5#',
    'r2qkbnr/ppp2ppp/2np4/4p3/2B1P1b1/2N2N1P/PPPP1PP1/R1BQK2R b KQkq - 0 5',
  ],
  ['OUTCOMES_ENTRY', 'a6', 'r2qkbnr/ppp2ppp/2np4/4p3/2B1P1b1/2N2N1P/PPPP1PP1/R1BQK2R b KQkq - 0 5'],
  [
    'OUTCOMES_ENTRY',
    'Bxb4',
    'r2qkbnr/ppp2ppp/2np4/4p3/2B1P1b1/2N2N1P/PPPP1PP1/R1BQK2R b KQkq - 0 5',
  ],
  [
    'OUTCOMES_ENTRY',
    'Bxf3_Qxf3',
    'r2qkbnr/ppp2ppp/2np4/4p3/2B1P3/2N2Q1P/PPPP1PP1/R1B1K2R b KQkq - 0 6',
  ],
  ['OUTCOMES_ENTRY', 'Be6', 'r2qkbnr/ppp2ppp/2npb3/4p3/2B1P3/2N2N1P/PPPP1PP1/R1BQK2R w KQkq - 1 6'],
  ['OUTCOMES_ENTRY', '', 'r2qkbnr/ppp2ppp/2np4/4p3/2B1P1b1/2N2N1P/PPPP1PP1/R1BQK2R b KQkq - 0 5'],
  ['WIDE_ENTRY', 'cxb5+a6', 'r1bqk1nr/pppp1ppp/2n5/2b1p3/1PB1P3/5N2/P1PP1PPP/RNBQK2R b KQkq - 0 4'],
  ['WIDE_ENTRY', 'fxe5', 'r1bqk1nr/pppp1ppp/2n5/2b1p3/1PB1P3/5N2/P1PP1PPP/RNBQK2R b KQkq - 0 4'],
  ['WIDE_ENTRY', 'Bc5', 'r1bqk1nr/pppp1ppp/2n5/2b1p3/1PB1P3/5N2/P1PP1PPP/RNBQK2R b KQkq - 0 4'],
  ['WIDE_ENTRY', 'Bxd1', 'r1bqk1nr/pppp1ppp/2n5/2b1p3/1PB1P3/5N2/P1PP1PPP/RNBQK2R b KQkq - 0 4'],
  [
    'WIDE_ENTRY',
    'fxe5_Qh5+_Ke7#_Qxe5+_Kf7_Bc4+',
    'r1bqk1nr/pppp1ppp/2n5/2b1p3/1PB1P3/5N2/P1PP1PPP/RNBQK2R b KQkq - 0 4',
  ],
  [
    'WIDE_ENTRY',
    '<script>alert(1)</script>',
    'r1bqk1nr/pppp1ppp/2n5/2b1p3/1PB1P3/5N2/P1PP1PPP/RNBQK2R b KQkq - 0 4',
  ],
  [
    'WIDE_ENTRY',
    'Bh5_Nxe5',
    'r1bqk1nr/pppp1ppp/2n5/2b1p3/1PB1P3/5N2/P1PP1PPP/RNBQK2R b KQkq - 0 4',
  ],
  [
    'WIDE_ENTRY',
    'e4_e5_not-a-move_Nf3',
    'r1bqk1nr/pppp1ppp/2n5/2b1p3/1PB1P3/5N2/P1PP1PPP/RNBQK2R b KQkq - 0 4',
  ],
  ['WIDE_ENTRY', 'Ba5', 'r1bqk1nr/pppp1ppp/2n5/2b1p3/1PB1P3/5N2/P1PP1PPP/RNBQK2R b KQkq - 0 4'],
  [
    'WIDE_ENTRY',
    'e4_e5_Nf3',
    'r1bqk1nr/pppp1ppp/2n5/2b1p3/1PB1P3/5N2/P1PP1PPP/RNBQK2R b KQkq - 0 4',
  ],
  [
    'WIDE_ENTRY',
    'fxe5_Qh5+',
    'r1bqk1nr/pppp1ppp/2n5/2b1p3/1PB1P3/5N2/P1PP1PPP/RNBQK2R b KQkq - 0 4',
  ],
  [
    'WIDE_ENTRY',
    'Nxe5_Bxd1_Bxf7+_Ke7_Nd5#',
    'r1bqk1nr/pppp1ppp/2n5/2b1p3/1PB1P3/5N2/P1PP1PPP/RNBQK2R b KQkq - 0 4',
  ],
  ['WIDE_ENTRY', 'a6', 'r1bqk1nr/pppp1ppp/2n5/2b1p3/1PB1P3/5N2/P1PP1PPP/RNBQK2R b KQkq - 0 4'],
  ['WIDE_ENTRY', 'Bxb4', 'r1bqk1nr/pppp1ppp/2n5/4p3/1bB1P3/5N2/P1PP1PPP/RNBQK2R w KQkq - 0 5'],
  [
    'WIDE_ENTRY',
    'Bxf3_Qxf3',
    'r1bqk1nr/pppp1ppp/2n5/2b1p3/1PB1P3/5N2/P1PP1PPP/RNBQK2R b KQkq - 0 4',
  ],
  ['WIDE_ENTRY', 'Be6', 'r1bqk1nr/pppp1ppp/2n5/2b1p3/1PB1P3/5N2/P1PP1PPP/RNBQK2R b KQkq - 0 4'],
  ['WIDE_ENTRY', '', 'r1bqk1nr/pppp1ppp/2n5/2b1p3/1PB1P3/5N2/P1PP1PPP/RNBQK2R b KQkq - 0 4'],
  [
    'compiled:proved-mate',
    'cxb5+a6',
    'r2qkbnr/ppp2ppp/2np4/4N2b/2B1P3/2N4P/PPPP1PP1/R1BQK2R b KQkq - 0 6',
  ],
  [
    'compiled:proved-mate',
    'fxe5',
    'r2qkbnr/ppp2ppp/2np4/4N2b/2B1P3/2N4P/PPPP1PP1/R1BQK2R b KQkq - 0 6',
  ],
  [
    'compiled:proved-mate',
    'Bc5',
    'r2qkbnr/ppp2ppp/2np4/4N2b/2B1P3/2N4P/PPPP1PP1/R1BQK2R b KQkq - 0 6',
  ],
  [
    'compiled:proved-mate',
    'Bxd1',
    'r2qkbnr/ppp2ppp/2np4/4N3/2B1P3/2N4P/PPPP1PP1/R1BbK2R w KQkq - 0 7',
  ],
  [
    'compiled:proved-mate',
    'fxe5_Qh5+_Ke7#_Qxe5+_Kf7_Bc4+',
    'r2qkbnr/ppp2ppp/2np4/4N2b/2B1P3/2N4P/PPPP1PP1/R1BQK2R b KQkq - 0 6',
  ],
  [
    'compiled:proved-mate',
    '<script>alert(1)</script>',
    'r2qkbnr/ppp2ppp/2np4/4N2b/2B1P3/2N4P/PPPP1PP1/R1BQK2R b KQkq - 0 6',
  ],
  [
    'compiled:proved-mate',
    'Bh5_Nxe5',
    'r2qkbnr/ppp2ppp/2np4/4N2b/2B1P3/2N4P/PPPP1PP1/R1BQK2R b KQkq - 0 6',
  ],
  [
    'compiled:proved-mate',
    'e4_e5_not-a-move_Nf3',
    'r2qkbnr/ppp2ppp/2np4/4N2b/2B1P3/2N4P/PPPP1PP1/R1BQK2R b KQkq - 0 6',
  ],
  [
    'compiled:proved-mate',
    'Ba5',
    'r2qkbnr/ppp2ppp/2np4/4N2b/2B1P3/2N4P/PPPP1PP1/R1BQK2R b KQkq - 0 6',
  ],
  [
    'compiled:proved-mate',
    'e4_e5_Nf3',
    'r2qkbnr/ppp2ppp/2np4/4N2b/2B1P3/2N4P/PPPP1PP1/R1BQK2R b KQkq - 0 6',
  ],
  [
    'compiled:proved-mate',
    'fxe5_Qh5+',
    'r2qkbnr/ppp2ppp/2np4/4N2b/2B1P3/2N4P/PPPP1PP1/R1BQK2R b KQkq - 0 6',
  ],
  [
    'compiled:proved-mate',
    'Nxe5_Bxd1_Bxf7+_Ke7_Nd5#',
    'r2qkbnr/ppp2ppp/2np4/4N2b/2B1P3/2N4P/PPPP1PP1/R1BQK2R b KQkq - 0 6',
  ],
  [
    'compiled:proved-mate',
    'a6',
    'r2qkbnr/ppp2ppp/2np4/4N2b/2B1P3/2N4P/PPPP1PP1/R1BQK2R b KQkq - 0 6',
  ],
  [
    'compiled:proved-mate',
    'Bxb4',
    'r2qkbnr/ppp2ppp/2np4/4N2b/2B1P3/2N4P/PPPP1PP1/R1BQK2R b KQkq - 0 6',
  ],
  [
    'compiled:proved-mate',
    'Bxf3_Qxf3',
    'r2qkbnr/ppp2ppp/2np4/4N2b/2B1P3/2N4P/PPPP1PP1/R1BQK2R b KQkq - 0 6',
  ],
  [
    'compiled:proved-mate',
    'Be6',
    'r2qkbnr/ppp2ppp/2np4/4N2b/2B1P3/2N4P/PPPP1PP1/R1BQK2R b KQkq - 0 6',
  ],
  [
    'compiled:proved-mate',
    '',
    'r2qkbnr/ppp2ppp/2np4/4N2b/2B1P3/2N4P/PPPP1PP1/R1BQK2R b KQkq - 0 6',
  ],
  [
    'compiled:taught-entry',
    'cxb5+a6',
    'rnbq1bnr/ppppk1pp/8/4Q3/4P3/8/PPPP1PPP/RNB1KB1R b KQ - 0 5',
  ],
  ['compiled:taught-entry', 'fxe5', 'rnbq1bnr/ppppk1pp/8/4Q3/4P3/8/PPPP1PPP/RNB1KB1R b KQ - 0 5'],
  ['compiled:taught-entry', 'Bc5', 'rnbq1bnr/ppppk1pp/8/4Q3/4P3/8/PPPP1PPP/RNB1KB1R b KQ - 0 5'],
  ['compiled:taught-entry', 'Bxd1', 'rnbq1bnr/ppppk1pp/8/4Q3/4P3/8/PPPP1PPP/RNB1KB1R b KQ - 0 5'],
  [
    'compiled:taught-entry',
    'fxe5_Qh5+_Ke7#_Qxe5+_Kf7_Bc4+',
    'rnbq1bnr/ppppk1pp/8/4Q3/4P3/8/PPPP1PPP/RNB1KB1R b KQ - 0 5',
  ],
  [
    'compiled:taught-entry',
    '<script>alert(1)</script>',
    'rnbq1bnr/ppppk1pp/8/4Q3/4P3/8/PPPP1PPP/RNB1KB1R b KQ - 0 5',
  ],
  [
    'compiled:taught-entry',
    'Bh5_Nxe5',
    'rnbq1bnr/ppppk1pp/8/4Q3/4P3/8/PPPP1PPP/RNB1KB1R b KQ - 0 5',
  ],
  [
    'compiled:taught-entry',
    'e4_e5_not-a-move_Nf3',
    'rnbq1bnr/ppppk1pp/8/4Q3/4P3/8/PPPP1PPP/RNB1KB1R b KQ - 0 5',
  ],
  ['compiled:taught-entry', 'Ba5', 'rnbq1bnr/ppppk1pp/8/4Q3/4P3/8/PPPP1PPP/RNB1KB1R b KQ - 0 5'],
  [
    'compiled:taught-entry',
    'e4_e5_Nf3',
    'rnbq1bnr/ppppk1pp/8/4Q3/4P3/8/PPPP1PPP/RNB1KB1R b KQ - 0 5',
  ],
  [
    'compiled:taught-entry',
    'fxe5_Qh5+',
    'rnbq1bnr/ppppk1pp/8/4Q3/4P3/8/PPPP1PPP/RNB1KB1R b KQ - 0 5',
  ],
  [
    'compiled:taught-entry',
    'Nxe5_Bxd1_Bxf7+_Ke7_Nd5#',
    'rnbq1bnr/ppppk1pp/8/4Q3/4P3/8/PPPP1PPP/RNB1KB1R b KQ - 0 5',
  ],
  ['compiled:taught-entry', 'a6', 'rnbq1bnr/ppppk1pp/8/4Q3/4P3/8/PPPP1PPP/RNB1KB1R b KQ - 0 5'],
  ['compiled:taught-entry', 'Bxb4', 'rnbq1bnr/ppppk1pp/8/4Q3/4P3/8/PPPP1PPP/RNB1KB1R b KQ - 0 5'],
  [
    'compiled:taught-entry',
    'Bxf3_Qxf3',
    'rnbq1bnr/ppppk1pp/8/4Q3/4P3/8/PPPP1PPP/RNB1KB1R b KQ - 0 5',
  ],
  ['compiled:taught-entry', 'Be6', 'rnbq1bnr/ppppk1pp/8/4Q3/4P3/8/PPPP1PPP/RNB1KB1R b KQ - 0 5'],
  ['compiled:taught-entry', '', 'rnbq1bnr/ppppk1pp/8/4Q3/4P3/8/PPPP1PPP/RNB1KB1R b KQ - 0 5'],
]

describe('every URL that worked before the defining line was walkable still resolves the same', () => {
  it.each(PUBLISHED)('%s ?line=%s', (name, raw, fen) => {
    const entry = FIXTURES[name]
    if (entry === undefined) throw new Error(`the table names an entry that is gone: ${name}`)

    expect(walkEntry(entry, null, parseLine(raw).plies, null).fen).toBe(fen)
  })

  /**
   * And with a `prelude` bolted on, which no published link can carry but an attacker or a
   * careless share certainly can. `line` wins, so the answer is identical.
   */
  it.each(PUBLISHED)('%s ?prelude=1&line=%s', (name, raw, fen) => {
    const entry = FIXTURES[name]
    if (entry === undefined) throw new Error(`the table names an entry that is gone: ${name}`)

    const { plies } = parseLine(raw)
    const prelude = parsePrelude('1').plies
    const walked = walkEntry(entry, prelude, plies, null)

    // Except where the line is empty: there the URL asks for the defining line and gets it,
    // which is the new behaviour and is not a published link.
    expect(walked.fen).toBe(plies.length === 0 ? walked.fen : fen)
    if (plies.length > 0) expect(walked.inPrelude).toBe(false)
  })

  /** The table is the point, so an empty or shrunken one is a failure in itself. */
  it('covers every fixture entry the suite has', () => {
    expect(PUBLISHED.length).toBe(Object.keys(FIXTURES).length * 17)
    expect(new Set(PUBLISHED.map(([name]) => name)).size).toBe(Object.keys(FIXTURES).length)
  })
})
