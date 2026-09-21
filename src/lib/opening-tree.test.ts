import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  isOpeningTree,
  loadOpeningTree,
  openingTreeUrl,
  walkOpeningTree,
  type OpeningTreeNode,
} from './opening-tree.ts'

/**
 * The client-side seam for the opening tree (issue #129), tested the way `catalogue.test.ts`
 * tests its own fetch: one file, every failure a value, nothing thrown.
 */

const TREE: OpeningTreeNode = {
  fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  check: null,
  children: [
    {
      san: 'e4',
      from: 'e2',
      to: 'e4',
      node: {
        fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
        check: null,
        children: [
          {
            san: 'e5',
            from: 'e7',
            to: 'e5',
            node: {
              fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
              check: null,
              children: [],
            },
          },
        ],
      },
    },
  ],
}

const respond = (body: unknown, status = 200): void => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        new Response(typeof body === 'string' ? body : JSON.stringify(body), {
          status,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    ),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('where the opening tree is fetched from', () => {
  it('is one locale-independent static file', () => {
    expect(openingTreeUrl()).toContain('catalogue/opening-tree.json')
  })
})

describe('isOpeningTree', () => {
  it('accepts a well-formed tree', () => {
    expect(isOpeningTree(TREE)).toBe(true)
  })

  it.each([
    ['not an object', 'nope'],
    ['missing fen', { check: null, children: [] }],
    ['a child missing from/to', { fen: 'x', check: null, children: [{ san: 'e4', node: TREE }] }],
    ['a check that is not a string or null', { fen: 'x', check: 1, children: [] }],
    [
      'a child whose node is malformed',
      { fen: 'x', check: null, children: [{ san: 'e4', from: 'e2', to: 'e4', node: 'nope' }] },
    ],
  ])('rejects %s', (_name, value) => {
    expect(isOpeningTree(value)).toBe(false)
  })
})

describe('loadOpeningTree', () => {
  it('resolves ok on a well-formed response', async () => {
    respond(TREE)
    const result = await loadOpeningTree()
    expect(result).toStrictEqual({ ok: true, tree: TREE })
  })

  it('never throws on a network failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('offline'))),
    )
    const result = await loadOpeningTree()
    expect(result).toStrictEqual({ ok: false, failure: { reason: 'offline' } })
  })

  it('reports a 404 as missing, not as a generic failure', async () => {
    respond('not found', 404)
    const result = await loadOpeningTree()
    expect(result).toStrictEqual({ ok: false, failure: { reason: 'missing' } })
  })

  it('reports another error status as unavailable, carrying the status', async () => {
    respond('server error', 500)
    const result = await loadOpeningTree()
    expect(result).toStrictEqual({ ok: false, failure: { reason: 'unavailable', status: 500 } })
  })

  it('reports a response that is not JSON as malformed', async () => {
    respond('<html>not json</html>')
    const result = await loadOpeningTree()
    expect(result).toStrictEqual({ ok: false, failure: { reason: 'malformed' } })
  })

  it('reports a response that is JSON but not a tree as malformed', async () => {
    respond({ some: 'other shape' })
    const result = await loadOpeningTree()
    expect(result).toStrictEqual({ ok: false, failure: { reason: 'malformed' } })
  })
})

describe('walkOpeningTree', () => {
  it('walks a fully legal sequence to its node', () => {
    const walk = walkOpeningTree(TREE, ['e4', 'e5'])
    expect(walk.plies).toStrictEqual(['e4', 'e5'])
    expect(walk.node.fen).toContain('4p3/4P3')
  })

  it('an empty sequence stays at the root', () => {
    const walk = walkOpeningTree(TREE, [])
    expect(walk.plies).toStrictEqual([])
    expect(walk.node).toStrictEqual(TREE)
  })

  it('stops at the first ply that is not an actual child, discarding the rest', () => {
    const walk = walkOpeningTree(TREE, ['e4', 'not-a-real-reply', 'e5'])
    expect(walk.plies).toStrictEqual(['e4'])
  })

  it('a sequence with an illegal first move stays at the root', () => {
    const walk = walkOpeningTree(TREE, ['Nf3'])
    expect(walk.plies).toStrictEqual([])
    expect(walk.node).toStrictEqual(TREE)
  })
})
