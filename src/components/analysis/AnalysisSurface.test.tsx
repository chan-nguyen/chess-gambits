import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Outlet, RouterProvider, createMemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { I18nProvider } from '../../i18n/I18nProvider.tsx'
import type { LocaleLoader } from '../../i18n/i18n.ts'
import vi from '../../locales/vi.ts'
import { shortcutStorageKey } from '../learn/shortcuts.ts'
import { AnalysisSurface } from './AnalysisSurface.tsx'
import type { AnalysisListener, Evaluation, EvaluationSource } from './evaluation.ts'

const A = vi.analysis

/**
 * The page against a fake engine that answers whenever the test says so — the seam ADR-0010
 * asked for and ADR-0012 made stream. What is under test is everything the page does with an
 * answer, and with none; the real engine is `e2e/analysis.spec.ts`'s.
 */

type Asked = { readonly fen: string; readonly listener: AnalysisListener; stopped: boolean }

const fakeSource = () => {
  const asked: Asked[] = []
  const source: EvaluationSource = {
    analyse: (fen, listener) => {
      const request: Asked = { fen, listener, stopped: false }
      asked.push(request)
      return () => {
        request.stopped = true
      }
    },
  }
  const current = (): Asked => {
    const request = asked.filter((one) => !one.stopped).at(-1)
    if (request === undefined) throw new Error('nothing is being analysed')
    return request
  }
  return { source, asked, current }
}

/** After 1.e4: Black to move, the engine prefers ...e5. */
const AFTER_E4: Evaluation = {
  depth: 18,
  complete: false,
  lines: [
    {
      score: { kind: 'cp', value: 32 },
      chances: { white: 60, draw: 920, black: 20 },
      moves: [
        { san: 'e5', from: 'e7', to: 'e5' },
        { san: 'Nf3', from: 'g1', to: 'f3' },
      ],
    },
    {
      score: { kind: 'cp', value: 41 },
      chances: { white: 70, draw: 910, black: 20 },
      moves: [{ san: 'c5', from: 'c7', to: 'c5' }],
    },
  ],
}

const load: LocaleLoader = () => Promise.resolve(vi)

const renderAt = (search: string, source: EvaluationSource) => {
  const router = createMemoryRouter(
    [
      {
        path: '/:locale',
        element: (
          <I18nProvider locale="vi" load={load}>
            <Outlet />
          </I18nProvider>
        ),
        children: [{ path: 'analysis', element: <AnalysisSurface source={source} /> }],
      },
    ],
    { initialEntries: [`/vi/analysis${search}`] },
  )
  render(<RouterProvider router={router} />)
  return router
}

const answer = (fake: ReturnType<typeof fakeSource>, evaluation: Evaluation) =>
  act(() => fake.current().listener.onUpdate(evaluation))

beforeEach(() => window.localStorage.clear())
afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

describe('before the engine has answered', () => {
  it('says it is loading, and asks about the position on the board', async () => {
    const fake = fakeSource()
    renderAt('?moves=e4', fake.source)

    expect(await screen.findByText(A.loading)).toBeInTheDocument()
    expect(fake.current().fen).toBe('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1')
  })

  it('labels everything as an estimate, before there is anything to label', async () => {
    renderAt('', fakeSource().source)
    expect(await screen.findByText(A.estimate)).toBeInTheDocument()
  })
})

describe('what the engine says', () => {
  it("shows the score from White's side, the depth, the chances and the lines", async () => {
    const fake = fakeSource()
    renderAt('?moves=e4', fake.source)
    await screen.findByText(A.loading)
    answer(fake, AFTER_E4)

    expect(document.querySelector('.engine-panel__value')).toHaveTextContent('+0.32')
    expect(screen.getByText(/Độ sâu 18/)).toHaveTextContent(A.searching)
    expect(screen.getByText('Trắng thắng 6% · Hoà 92% · Đen thắng 2%')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Đi e5/ })).toHaveTextContent('1...e5 2.Nf3')
    expect(screen.getByRole('button', { name: /Đi c5/ })).toBeInTheDocument()
  })

  it('draws the best move as an arrow on the board', async () => {
    const fake = fakeSource()
    renderAt('?moves=e4', fake.source)
    await screen.findByText(A.loading)
    answer(fake, AFTER_E4)

    expect(document.querySelectorAll('polygon.board__arrow')).toHaveLength(1)
  })

  it('words a mate as what Stockfish sees, not as a proof', async () => {
    const fake = fakeSource()
    renderAt('?moves=f3_e5_g4', fake.source)
    await screen.findByText(A.loading)
    answer(fake, {
      depth: 8,
      complete: true,
      lines: [
        {
          score: { kind: 'mate', value: -1 },
          chances: { white: 0, draw: 0, black: 1000 },
          moves: [{ san: 'Qh4#', from: 'd8', to: 'h4' }],
        },
      ],
    })

    expect(document.querySelector('.engine-panel__value')).toHaveTextContent('-M1')
    expect(screen.getByText('Stockfish thấy Đen chiếu hết trong 1 nước.')).toBeInTheDocument()
    expect(document.querySelector('.mate-outcome')).toBeNull()
  })

  it('stops asking about a position the board has left', async () => {
    const fake = fakeSource()
    const router = renderAt('?moves=e4', fake.source)
    await screen.findByText(A.loading)
    const first = fake.current()

    await act(() => router.navigate('/vi/analysis?moves=e4_e5'))
    expect(first.stopped).toBe(true)
    expect(fake.current().fen).toContain(' w ')
  })

  it('says so when the engine cannot run', async () => {
    const fake = fakeSource()
    renderAt('', fake.source)
    await screen.findByText(A.loading)
    act(() => fake.current().listener.onFailure())

    expect(screen.getByRole('alert')).toHaveTextContent(A.failed)
  })
})

describe('a finished game', () => {
  it('asks the engine nothing, and says the game is over', async () => {
    const fake = fakeSource()
    renderAt('?moves=f3_e5_g4_Qh4%23', fake.source)

    expect(await screen.findByText(A.gameOver)).toBeInTheDocument()
    expect(fake.asked).toHaveLength(0)
  })
})

describe('moving through the line', () => {
  it('plays a line’s first move when it is chosen', async () => {
    const fake = fakeSource()
    const router = renderAt('?moves=e4', fake.source)
    await screen.findByText(A.loading)
    answer(fake, AFTER_E4)

    fireEvent.click(screen.getByRole('button', { name: /Đi c5/ }))
    await waitFor(() => expect(router.state.location.search).toBe('?moves=e4_c5'))
  })

  it('keeps the rest of the line when stepping back, and replaces it with a new move', async () => {
    const fake = fakeSource()
    const router = renderAt('?moves=e4_e5_Nf3', fake.source)
    await screen.findByText(A.loading)

    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    await waitFor(() => expect(router.state.location.search).toBe('?moves=e4_e5_Nf3&ply=2'))
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    await waitFor(() => expect(router.state.location.search).toBe('?moves=e4_e5_Nf3&ply=1'))

    answer(fake, AFTER_E4)
    fireEvent.click(screen.getByRole('button', { name: /Đi c5/ }))
    await waitFor(() => expect(router.state.location.search).toBe('?moves=e4_c5'))
  })

  it('marks the move on the board in the move list, and links every other one', async () => {
    renderAt('?moves=e4_e5_Nf3&ply=2', fakeSource().source)

    const current = await screen.findByRole('link', { current: 'step' })
    expect(current).toHaveTextContent('e5')
    expect(screen.getByRole('link', { name: 'Nf3' })).toHaveAttribute(
      'href',
      '/vi/analysis?moves=e4_e5_Nf3',
    )
  })

  it('goes nowhere past either end', async () => {
    const router = renderAt('?moves=e4', fakeSource().source)
    await screen.findByText(A.loading)

    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(router.state.location.search).toBe('?moves=e4')
    expect(screen.getByText(A.atEnd)).toBeInTheDocument()
  })
})

describe('turning the board', () => {
  it('flips on the control and on f, keeping the position', async () => {
    const router = renderAt('?moves=e4', fakeSource().source)
    await screen.findByText(A.loading)
    expect(document.querySelector('[role="grid"] [data-square]')).toHaveAttribute(
      'data-square',
      'a8',
    )

    fireEvent.click(screen.getByRole('button', { name: vi.board.flip }))
    await waitFor(() => expect(router.state.location.search).toBe('?moves=e4&flip=1'))
    expect(document.querySelector('[role="grid"] [data-square]')).toHaveAttribute(
      'data-square',
      'h1',
    )

    fireEvent.keyDown(window, { key: 'f' })
    await waitFor(() => expect(router.state.location.search).toBe('?moves=e4'))
  })

  it('leaves the keys alone once single-key shortcuts are off', async () => {
    window.localStorage.setItem(shortcutStorageKey, 'off')
    const router = renderAt('?moves=e4', fakeSource().source)
    await screen.findByText(A.loading)

    fireEvent.keyDown(window, { key: 'f' })
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(router.state.location.search).toBe('?moves=e4')
  })
})

describe('pasting a game', () => {
  it('opens a valid PGN at its last move', async () => {
    const router = renderAt('', fakeSource().source)
    fireEvent.change(await screen.findByLabelText(A.pgnLabel), {
      target: { value: '1. d4 d5 2. c4 e6 *' },
    })
    fireEvent.click(screen.getByRole('button', { name: A.pgnLoad }))

    await waitFor(() => expect(router.state.location.search).toBe('?moves=d4_d5_c4_e6'))
  })

  it('refuses an invalid one in words, and leaves the page where it was', async () => {
    const router = renderAt('?moves=e4', fakeSource().source)
    fireEvent.change(await screen.findByLabelText(A.pgnLabel), {
      target: { value: '1. e4 Ke7 2. Qz9' },
    })
    fireEvent.click(screen.getByRole('button', { name: A.pgnLoad }))

    expect(await screen.findByText(A.pgnInvalid)).toBeInTheDocument()
    expect(router.state.location.search).toBe('?moves=e4')
  })
})

describe('a position set up by hand', () => {
  const EMPTY = encodeURIComponent('8/8/8/8/8/8/8/8 w - - 0 1')
  const square = (name: string) => {
    const cell = document.querySelector(`[data-square="${name}"]`)
    if (cell === null) throw new Error(`no ${name} on the board`)
    return cell
  }
  const setupIn = (router: ReturnType<typeof renderAt>) =>
    new URLSearchParams(router.state.location.search).get('setup')

  it('opens from the position on the board, beside the line, and asks the engine nothing', async () => {
    const fake = fakeSource()
    const router = renderAt('?moves=e4', fake.source)
    const open = await screen.findByRole('link', { name: A.setupOpen })
    expect(open).toHaveAttribute(
      'href',
      `/vi/analysis?moves=e4&setup=${encodeURIComponent(
        'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
      )}`,
    )

    const asked = fake.asked.length
    fireEvent.click(open)
    expect(await screen.findByRole('heading', { name: A.setupHeading })).toBeInTheDocument()
    expect(fake.asked.filter((one) => !one.stopped)).toHaveLength(0)
    expect(fake.asked.length).toBe(asked)
    expect(router.state.location.search).toContain('moves=e4&setup=')
  })

  it('puts pieces down, says why it cannot be analysed yet, then analyses it', async () => {
    const fake = fakeSource()
    const router = renderAt(`?setup=${EMPTY}`, fake.source)
    const analyse = await screen.findByRole('button', { name: A.setupAnalyse })

    expect(analyse).toHaveAttribute('aria-disabled', 'true')
    expect(analyse).toHaveAccessibleDescription(A.setupWhiteKing)
    fireEvent.click(analyse)
    expect(router.state.location.search).toBe(`?setup=${EMPTY}`)

    fireEvent.click(screen.getByRole('button', { name: vi.board.whiteKing }))
    fireEvent.click(square('e1'))
    // Said by the board's own live region, in the words its squares use.
    expect(document.querySelector('.board__announcement')).toHaveTextContent(
      `e1, ${vi.board.whiteKing}`,
    )
    fireEvent.click(screen.getByRole('button', { name: vi.board.blackKing }))
    fireEvent.click(square('e8'))
    fireEvent.click(screen.getByRole('button', { name: vi.board.whiteQueen }))
    fireEvent.click(square('d1'))
    fireEvent.click(screen.getByRole('radio', { name: A.setupBlackToMove }))

    await waitFor(() => expect(setupIn(router)).toBe('4k3/8/8/8/8/8/8/3QK3 b - - 0 1'))
    expect(analyse).toHaveAttribute('aria-disabled', 'false')
    expect(analyse).toHaveAccessibleDescription(A.setupReady)

    fireEvent.click(analyse)
    await waitFor(() =>
      expect(router.state.location.search).toBe(
        `?fen=${encodeURIComponent('4k3/8/8/8/8/8/8/3QK3 b - - 0 1')}`,
      ),
    )
    expect(fake.current().fen).toBe('4k3/8/8/8/8/8/8/3QK3 b - - 0 1')
  })

  it('takes a piece off with the same piece again, or with the eraser', async () => {
    const router = renderAt(`?setup=${EMPTY}`, fakeSource().source)
    fireEvent.click(await screen.findByRole('button', { name: vi.board.whiteKnight }))
    fireEvent.click(square('f3'))
    expect(square('f3')).toHaveAccessibleName(`f3, ${vi.board.whiteKnight}`)
    fireEvent.click(square('f3'))
    expect(square('f3')).toHaveAccessibleName(`f3, ${vi.board.emptySquare}`)

    fireEvent.click(square('g3'))
    fireEvent.click(screen.getByRole('button', { name: A.setupErase }))
    fireEvent.click(square('g3'))
    await waitFor(() => expect(setupIn(router)).toBe('8/8/8/8/8/8/8/8 w - - 0 1'))
  })

  it('picks a piece up and puts it down elsewhere with the move tool', async () => {
    const router = renderAt(
      `?setup=${encodeURIComponent('4k3/8/8/8/8/8/8/4K3 w - - 0 1')}`,
      fakeSource().source,
    )
    expect(await screen.findByRole('button', { name: A.setupMove })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    fireEvent.click(square('e1'))
    fireEvent.click(square('d2'))
    await waitFor(() => expect(setupIn(router)).toBe('4k3/8/8/8/8/8/3K4/8 w - - 0 1'))
    // An empty square picks nothing up, so the next click puts nothing down.
    fireEvent.click(square('a1'))
    fireEvent.click(square('b1'))
    expect(setupIn(router)).toBe('4k3/8/8/8/8/8/3K4/8 w - - 0 1')
  })

  it('offers castling only while the king and rook are at home', async () => {
    renderAt(
      `?setup=${encodeURIComponent('r3k2r/8/8/8/8/8/8/4K2R w Kkq - 0 1')}`,
      fakeSource().source,
    )

    expect(await screen.findByRole('checkbox', { name: A.setupWhiteShort })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: A.setupWhiteLong })).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: A.setupBlackLong })).toBeEnabled()
    fireEvent.click(screen.getByRole('checkbox', { name: A.setupBlackLong }))
    expect(screen.getByRole('textbox', { name: A.setupFen })).toHaveValue(
      'r3k2r/8/8/8/8/8/8/4K2R w Kk - 0 1',
    )
  })

  it('opens a pasted FEN, and keeps one it cannot read as typed', async () => {
    const router = renderAt(`?setup=${EMPTY}`, fakeSource().source)
    const field = await screen.findByRole('textbox', { name: A.setupFen })

    fireEvent.change(field, { target: { value: '8/8/8/8/8/8/8/9 w' } })
    expect(field).toHaveValue('8/8/8/8/8/8/8/9 w')
    expect(screen.getByText(A.setupFenUnreadable)).toBeInTheDocument()

    fireEvent.change(field, { target: { value: '4k3/8/8/8/8/8/8/4K3 b' } })
    expect(field).toHaveValue('4k3/8/8/8/8/8/8/4K3 b')
    expect(square('e8')).toHaveAccessibleName(`e8, ${vi.board.blackKing}`)
    await waitFor(() => expect(setupIn(router)).toBe('4k3/8/8/8/8/8/8/4K3 b - - 0 1'))
    expect(screen.queryByText(A.setupFenUnreadable)).toBeNull()
  })

  it('cancels back to exactly what was on screen', async () => {
    renderAt(`?moves=e4_e5&ply=1&flip=1&setup=${EMPTY}`, fakeSource().source)
    expect(await screen.findByRole('link', { name: A.setupCancel })).toHaveAttribute(
      'href',
      '/vi/analysis?moves=e4_e5&ply=1&flip=1',
    )
  })

  it('turns the board round with the board as it stands, not as the URL last had it', async () => {
    const router = renderAt(`?setup=${EMPTY}`, fakeSource().source)
    fireEvent.click(await screen.findByRole('button', { name: vi.board.whiteKing }))
    fireEvent.click(square('e1'))
    fireEvent.click(screen.getByRole('button', { name: vi.board.flip }))

    await waitFor(() => expect(router.state.location.search).toContain('flip=1'))
    expect(setupIn(router)).toBe('8/8/8/8/8/8/8/4K3 w - - 0 1')
    expect(square('e1')).toHaveAccessibleName(`e1, ${vi.board.whiteKing}`)
    expect(document.querySelector('[role="grid"] [data-square]')).toHaveAttribute(
      'data-square',
      'h1',
    )
  })

  it('leaves the page keys to the editor while it is open', async () => {
    const router = renderAt(`?moves=e4&setup=${EMPTY}`, fakeSource().source)
    await screen.findByRole('heading', { name: A.setupHeading })
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    fireEvent.keyDown(window, { key: 'f' })
    expect(router.state.location.search).toBe(`?moves=e4&setup=${EMPTY}`)
  })
})

describe('a line from a set-up position', () => {
  const START = '4k3/8/8/8/8/8/8/3QK3 b - - 0 14'

  it('is analysed from that position, and numbered from its move', async () => {
    const fake = fakeSource()
    renderAt(`?fen=${encodeURIComponent(START)}&moves=Kf7_Qd7%2B`, fake.source)

    expect(await screen.findByRole('link', { current: 'step' })).toHaveTextContent('Qd7+')
    expect(document.querySelector('.analysis-moves__list')).toHaveTextContent('14.…Kf715.Qd7+')
    expect(fake.current().fen).toBe('8/3Q1k2/8/8/8/8/8/4K3 b - - 2 15')
  })

  it('starts from the initial position when the FEN cannot be analysed', async () => {
    const fake = fakeSource()
    renderAt(`?fen=${encodeURIComponent('8/8/8/8/8/8/8/8 w - - 0 1')}&moves=e4`, fake.source)
    await screen.findByText(A.loading)
    expect(fake.current().fen).toBe('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1')
  })
})
