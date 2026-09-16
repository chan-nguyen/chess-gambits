// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { certificateFileName, certificateJson, countNet, parseCertificate } from './certificate.ts'

describe('where a certificate lives', () => {
  it('is derived from the entry and the node, never stored in the file', () => {
    expect(certificateFileName('legal-trap', ['Bxd1'])).toBe('legal-trap.Bxd1.mate.json')
  })

  /**
   * The same hazard as a `line` URL parameter (docs/CONTEXT.md, Path), and for the same
   * reason: check and mate suffixes carry `+` and `#`. A proof of a mate is the likeliest
   * file in this project to have a `#` in its name.
   */
  it('percent-encodes a path the way a line parameter is encoded', () => {
    expect(certificateFileName('damiano', ['Qh5+', 'Ke7', 'Nd5#'])).toBe(
      'damiano.Qh5%2B_Ke7_Nd5%23.mate.json',
    )
    expect(certificateFileName('damiano', ['Qh5+', 'Ke7', 'Nd5#'])).not.toContain('#')
    expect(certificateFileName('damiano', ['Qh5+', 'Ke7', 'Nd5#'])).not.toContain('+')
  })
})

describe('reading a certificate', () => {
  const certificate = {
    entry: 'legal-trap',
    node: ['Bxd1'],
    line: ['e4', 'e5', 'Bxd1'],
    inMoves: 2,
    net: { ply: 'Bxf7+', defences: [{ ply: 'Ke7', answer: { ply: 'Nd5#', defences: [] } }] },
  }

  it('accepts a well-formed one', () => {
    const parsed = parseCertificate(certificate)

    expect(parsed.ok).toBe(true)
  })

  it('refuses a field it does not recognise, rather than ignoring it', () => {
    const parsed = parseCertificate({ ...certificate, evaluation: '+5.2' })

    expect(parsed.ok).toBe(false)
  })

  it('refuses a stored position, because a position is replayed and never asserted', () => {
    const parsed = parseCertificate({ ...certificate, fen: '8/8/8/8/8/8/8/8 w - - 0 1' })

    expect(parsed.ok).toBe(false)
  })

  it('refuses a move count that is not a whole number of moves', () => {
    expect(parseCertificate({ ...certificate, inMoves: 0 }).ok).toBe(false)
    expect(parseCertificate({ ...certificate, inMoves: 1.5 }).ok).toBe(false)
  })
})

describe('what a certificate costs', () => {
  it('counts the attacker moves and the defender nodes in it', () => {
    const counted = countNet({
      ply: 'Bxf7+',
      defences: [{ ply: 'Ke7', answer: { ply: 'Nd5#', defences: [] } }],
    })

    expect(counted).toEqual({ attackerMoves: 2, defenderNodes: 1 })
  })

  it('counts a mate in one as one move over no defender node at all', () => {
    expect(countNet({ ply: 'Qc1#', defences: [] })).toEqual({
      attackerMoves: 1,
      defenderNodes: 0,
    })
  })

  it('is written to be read in a diff during review, not minified', () => {
    const json = certificateJson({
      entry: 'legal-trap',
      node: ['Bxd1'],
      line: ['e4'],
      inMoves: 1,
      net: { ply: 'Qc1#', defences: [] },
    })

    expect(json).toContain('\n')
    expect(json.endsWith('\n')).toBe(true)
  })
})
