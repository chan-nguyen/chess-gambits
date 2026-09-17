// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { findEncodingDamage } from './text-encoding.ts'
import { loadYaml } from './yaml-source.ts'

/**
 * **The check that reads the prose (issue #85).**
 *
 * `content/kings-gambit.yaml` served `le mÃªme plan` to production for as long as it existed,
 * in the one locale nobody on this project reads. Every other gate had nothing to say: they
 * replay the chess.
 *
 * Nothing below contains a corrupted byte. Each test writes the text it *means*, damages it
 * here with `damaged()` — which is the bug itself, one line of it — and asserts that the
 * check names the damage and hands back the original. Writing the corruption out by hand
 * would put a test at the mercy of whatever next opens this file.
 */

/** UTF-8 bytes read back one byte at a time, which is the whole of how this happens. */
const damaged = (text: string): string => Buffer.from(text, 'utf8').toString('latin1')

const damageIn = (text: string) => {
  const loaded = loadYaml('probe.yaml', `value: ${JSON.stringify(text)}\n`)
  if (!loaded.ok) throw new Error(`the probe's own YAML did not load: ${loaded.issues.length}`)
  return findEncodingDamage(loaded.source)
}

const messageFor = (text: string): string => {
  const [issue] = damageIn(text)
  if (issue === undefined) throw new Error('no damage reported')
  return issue.message
}

describe('text that has been through the wrong encoding', () => {
  it('is what `damaged` actually produces, so these tests are about the real bug', () => {
    // The exact string the site served, arrived at from the clean one.
    expect(damaged('le même plan')).toBe('le mÃªme plan')
  })

  it('finds two-byte damage and says what the text should read', () => {
    const issues = damageIn(damaged('soit paré avant d’être joué'))
    expect(issues).toHaveLength(1)
    expect(issues[0]?.code).toBe('text-double-encoded')
    expect(issues[0]?.message).toContain('`é`')
  })

  /**
   * The reason this check is not a search for one character.
   *
   * French and English accents are two UTF-8 bytes and lead with `Ã`. Vietnamese is mostly
   * three, and leads with an ordinary French letter instead — so a check built around the
   * character the bug was first seen with would pass in the project's primary locale.
   */
  it('finds three-byte Vietnamese damage, which leads with no such character', () => {
    const broken = damaged('thế cờ')
    expect(broken).not.toContain('Ã')

    const issues = damageIn(broken)
    expect(issues).toHaveLength(1)
    expect(issues[0]?.message).toContain('`ế`')
  })

  it('repairs a three-byte character whole rather than the first two bytes of it', () => {
    // Read shortest-first, `ế` would come back as a two-byte character plus a leftover.
    expect(messageFor(damaged('ế'))).toContain('`ế`')
    expect(messageFor(damaged('ế'))).not.toContain('`Ã')
  })

  it('finds damaged punctuation, which is neither letter nor Latin-1', () => {
    expect(messageFor(damaged('White’s plan'))).toContain('’')
  })

  it('counts every run in one string and shows the first few', () => {
    const issues = damageIn(damaged('désormais attaqué aussitôt, amènent, libérer, pièce'))
    expect(issues[0]?.message).toMatch(/^This text has been through the wrong encoding: 6 run/)
    expect(issues[0]?.message).toContain('and 2 more')
  })

  it('reports where the text lives, not just that a file is wrong', () => {
    const loaded = loadYaml(
      'probe.yaml',
      `soundness:\n  basis:\n    source: ${JSON.stringify(damaged('paré'))}\n`,
    )
    if (!loaded.ok) throw new Error('probe did not load')
    const [issue] = findEncodingDamage(loaded.source)
    expect(issue?.dataPath).toBe('soundness.basis.source')
    expect(issue?.at?.line).toBe(3)
  })

  it('walks arrays as well as objects, so a list of prose is not a blind spot', () => {
    const loaded = loadYaml(
      'probe.yaml',
      `notes:\n  - ok\n  - ${JSON.stringify(damaged('paré'))}\n`,
    )
    if (!loaded.ok) throw new Error('probe did not load')
    expect(findEncodingDamage(loaded.source)[0]?.dataPath).toBe('notes[1]')
  })
})

/**
 * The other half, and the half a check like this usually gets wrong: legitimate text.
 *
 * Every string below is the kind of thing this repository's three locales really contain.
 * A check that fires on any of them would be worse than no check, because it would be
 * switched off.
 */
describe('text that is merely accented', () => {
  const REAL: readonly string[] = [
    // Vietnamese, including the capital letter the damage's usual first character also is.
    'Trắng cho không một con tốt ở f4 để đổi lấy trung tâm và cột f.',
    'Ã là một chữ cái, và đã, sẽ, cũng vậy.',
    'Đen chơi một nước khác — Trắng tiếp tục kế hoạch cũ.',
    // French, with the punctuation Latin-1 keeps in the same range as a continuation byte.
    "Les Blancs poursuivent le même plan — Nf3 d'abord, pour que ...Qh4+ soit paré.",
    'Le prix à payer est la diagonale e1-h4, dite « ouverte », à 20° près.',
    'Les Noirs n’ont encore développé aucune pièce.',
    // English, and the typography the entries actually use.
    'White’s bishop — the one on c4 — eyes f7: “the weakest square”.',
  ]

  for (const text of REAL) {
    it(`says nothing about ${text.slice(0, 32)}…`, () => {
      expect(damageIn(text)).toEqual([])
    })
  }

  it('says nothing about any of it, which is the claim that matters', () => {
    expect(REAL.flatMap((text) => damageIn(text))).toEqual([])
  })

  /**
   * And the boundary between the two describes: damaging any of those strings is caught.
   * Without this, a check that never fires at all would pass everything above.
   */
  it('but finds the damage in every one of them once it has been done', () => {
    for (const text of REAL) {
      expect(damageIn(damaged(text)).length, text.slice(0, 32)).toBeGreaterThan(0)
    }
  })
})
