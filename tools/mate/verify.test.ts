// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { CERTIFICATE_SUFFIX } from './corpus.ts'
import type { Certificate } from './certificate.ts'
import { parseCertificate } from './certificate.ts'
import type { VerificationReason } from './verify.ts'
import { verifyCertificate } from './verify.ts'

/**
 * The verifier is the product's only guarantee, so it is tested in both directions: the
 * certificates that must pass with the right move count (AC 7), and the certificates that
 * must be **refused with the reason named** (AC 6).
 *
 * A verifier with no tests that must fail is not a verifier. Every check in ADR-0005 has a
 * fixture below whose whole purpose is to trip it.
 */

const valid = fileURLToPath(new URL('./fixtures/valid/', import.meta.url))
const invalid = fileURLToPath(new URL('./fixtures/invalid/', import.meta.url))

const read = (directory: string, name: string): unknown =>
  JSON.parse(readFileSync(`${directory}${name}`, 'utf8'))

const certificatesIn = (directory: string): readonly string[] =>
  readdirSync(directory)
    .filter((name) => name.endsWith(CERTIFICATE_SUFFIX))
    .sort()

type Expectation = {
  readonly inMoves: number
  readonly attacker: 'white' | 'black'
  readonly sequence: readonly string[]
  readonly defenderNodes: number
}

/**
 * AC 7. The five trap lines, each verified against `chess.js` rather than against a
 * published source — three of which name the wrong losing move (see the fixture headers).
 */
const MUST_VERIFY: Readonly<Record<string, Expectation>> = {
  'fixture-blackburne-shilling.Be2.mate.json': {
    inMoves: 1,
    attacker: 'black',
    sequence: ['Nf3#'],
    defenderNodes: 0,
  },
  'fixture-englund-gambit.Qxc3.mate.json': {
    inMoves: 1,
    attacker: 'black',
    sequence: ['Qc1#'],
    defenderNodes: 0,
  },
  'fixture-halosar-trap.Bxf3.mate.json': {
    inMoves: 1,
    attacker: 'white',
    sequence: ['Nxc7#'],
    defenderNodes: 0,
  },
  'fixture-kieninger-trap.axb4.mate.json': {
    inMoves: 1,
    attacker: 'black',
    sequence: ['Nd3#'],
    defenderNodes: 0,
  },
  'fixture-legal-trap.Bxd1.mate.json': {
    inMoves: 2,
    attacker: 'white',
    sequence: ['Bxf7+', 'Ke7', 'Nd5#'],
    defenderNodes: 1,
  },
}

type Refusal = {
  readonly reason: VerificationReason
  /** A fragment the message must contain, so a vague refusal fails the test. */
  readonly says: string
  /** Where the cap is the point of the fixture rather than the file's contents. */
  readonly nodeCap?: number
}

/** AC 6. Every one of these must be rejected, and for the stated reason. */
const MUST_BE_REFUSED: Readonly<Record<string, Refusal>> = {
  'fixture-stalemate-terminal.Kg6.mate.json': {
    reason: 'stalemate-terminal',
    says: 'stalemate',
  },
  'fixture-assessment-leaf-inside-net.Kf3.mate.json': {
    reason: 'non-mate-terminal',
    says: 'the game does not',
  },
  'fixture-missing-underpromotion.Kf3.mate.json': {
    reason: 'defences-not-set-equal',
    says: 'missing c8=B',
  },
  'fixture-missing-defender-reply.Kf3.mate.json': {
    reason: 'defences-not-set-equal',
    says: 'missing Be7',
  },
  'fixture-not-minimal.Kf3.mate.json': {
    reason: 'not-minimal',
    says: 'mate in 2 is forced',
  },
  'fixture-repetition.Nb1.mate.json': {
    reason: 'repetition',
    says: 'occurred three times',
  },
  'fixture-search-cap.Bxd1.mate.json': {
    reason: 'search-cap',
    says: 'node cap',
    // The file is a *valid* mate in two. What is refused is the claim, because at this cap
    // the minimality search cannot settle it — and an unproved claim is never accepted for
    // want of a refutation (ADR-0005, "Failing safe"; issue #5, AC 5).
    nodeCap: 100,
  },
}

describe('certificates that must verify', () => {
  for (const [name, expected] of Object.entries(MUST_VERIFY)) {
    it(`proves a mate in ${expected.inMoves} from ${name}`, () => {
      const result = verifyCertificate(name, read(valid, name))

      if (!result.ok) throw new Error(result.failures.map((f) => f.message).join('\n'))
      expect(result.proof.inMoves).toBe(expected.inMoves)
      expect(result.proof.attacker).toBe(expected.attacker)
      expect(result.proof.sequence).toEqual(expected.sequence)
      expect(result.proof.defenderNodes).toBe(expected.defenderNodes)
      // A mate in N runs to 2N-1 plies when the defender holds out longest.
      expect(result.proof.sequence).toHaveLength(2 * expected.inMoves - 1)
    })
  }

  it('has an expectation for every certificate in the valid corpus', () => {
    expect(certificatesIn(valid)).toEqual(Object.keys(MUST_VERIFY).sort())
  })
})

describe('certificates that must be refused', () => {
  for (const [name, expected] of Object.entries(MUST_BE_REFUSED)) {
    it(`refuses ${name} with ${expected.reason}`, () => {
      const result = verifyCertificate(
        name,
        read(invalid, name),
        expected.nodeCap === undefined ? {} : { nodeCap: expected.nodeCap },
      )

      expect(result.ok).toBe(false)
      if (result.ok) return
      const matching = result.failures.filter((failure) => failure.reason === expected.reason)
      expect(matching.map((failure) => failure.message).join('\n')).toContain(expected.says)
    })
  }

  it('has an expectation for every certificate in the red corpus', () => {
    expect(certificatesIn(invalid)).toEqual(Object.keys(MUST_BE_REFUSED).sort())
    expect(certificatesIn(invalid).length).toBeGreaterThanOrEqual(7)
  })

  it('names where in the net each refusal happened', () => {
    for (const [name, expected] of Object.entries(MUST_BE_REFUSED)) {
      const result = verifyCertificate(
        name,
        read(invalid, name),
        expected.nodeCap === undefined ? {} : { nodeCap: expected.nodeCap },
      )
      if (result.ok) continue
      for (const failure of result.failures) {
        expect(failure.at.length).toBeGreaterThan(0)
        expect(failure.message.length).toBeGreaterThan(30)
      }
    }
  })
})

/**
 * The underpromotion check, shown to be load-bearing rather than merely present.
 *
 * The rejected fixture and the accepted certificate below differ by exactly one move: the
 * bishop promotion. `chess.js` enumerates all four promotion pieces, and a net that answers
 * three of them has not answered the position.
 */
describe('the one move that decides it', () => {
  const name = 'fixture-missing-underpromotion.Kf3.mate.json'

  const restored = (): Certificate => {
    const parsed = parseCertificate(read(invalid, name))
    if (!parsed.ok) throw new Error(parsed.problems.join('; '))
    const net = parsed.certificate.net
    const queen = net.defences.find((defence) => defence.ply === 'c8=Q')
    if (queen === undefined) throw new Error('the fixture no longer promotes to a queen')
    return {
      ...parsed.certificate,
      net: {
        ply: net.ply,
        // The same answer works whichever piece the pawn becomes: it is a mate the promoted
        // piece cannot touch. That is precisely why leaving one out is so easy to miss.
        defences: [...net.defences, { ply: 'c8=B', answer: queen.answer }],
      },
    }
  }

  it('refuses the net that answers three promotions', () => {
    const result = verifyCertificate(name, read(invalid, name))

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.failures.map((failure) => failure.reason)).toEqual(['defences-not-set-equal'])
    expect(result.failures[0]?.message).toContain('all four of `=Q`, `=R`, `=B` and `=N`')
  })

  it('accepts the same net once the bishop promotion is answered too', () => {
    const result = verifyCertificate(name, restored())

    if (!result.ok) throw new Error(result.failures.map((f) => f.message).join('\n'))
    expect(result.proof.inMoves).toBe(2)
    expect(result.proof.defenderNodes).toBe(1)
  })
})

describe('a certificate that proves the wrong thing', () => {
  const legal = (): Certificate => {
    const parsed = parseCertificate(read(valid, 'fixture-legal-trap.Bxd1.mate.json'))
    if (!parsed.ok) throw new Error(parsed.problems.join('; '))
    return parsed.certificate
  }

  it('is refused when the file name does not match what it proves', () => {
    const result = verifyCertificate('some-other-entry.Bxd1.mate.json', legal())

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.failures.map((failure) => failure.reason)).toContain('certificate-misfiled')
  })

  it('is refused when the line does not end at the node it claims', () => {
    const certificate: Certificate = { ...legal(), node: ['Bxf7+'] }
    const result = verifyCertificate('fixture-legal-trap.Bxf7%2B.mate.json', certificate)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.failures.map((failure) => failure.reason)).toContain('line-mismatched')
  })

  it('is refused when it is not a certificate at all', () => {
    const result = verifyCertificate('x.mate.json', { entry: 'x' })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.failures.map((failure) => failure.reason)).toEqual(['certificate-malformed'])
  })

  /**
   * The vacuous-truth hole, closed explicitly. An empty defence list and an empty legal move
   * list are set-equal, so `{} == {}` would pass check 2 while the position is a stalemate —
   * a draw published as a forced mate.
   */
  it('is refused when an empty defence list would satisfy set-equality vacuously', () => {
    const name = 'fixture-stalemate-terminal.Kg6.mate.json'
    const result = verifyCertificate(name, read(invalid, name))

    expect(result.ok).toBe(false)
    if (result.ok) return
    const stalemate = result.failures.find((failure) => failure.reason === 'stalemate-terminal')
    expect(stalemate?.message).toContain('vacuously')
  })
})
