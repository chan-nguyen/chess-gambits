import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { Link, useLocation } from 'react-router'
import './GambitTree.css'
import { Translated } from '../../i18n/Translated.tsx'
import { useTranslated } from '../../i18n/useTranslated.ts'
import type { CompiledEntry } from '../../lib/content-types.ts'
import { lineSearch } from '../../lib/line.ts'
import {
  arrowTarget,
  countLines,
  flattenChain,
  layoutTree,
  leafMarkers,
  minWidthQuery,
  treeBreakpoints,
  treeNavigationKeys,
  type TreeChain,
  type TreeItem,
  type TreeMode,
} from './tree-layout.ts'
import { plyLabel, resolvePath } from './tree-path.ts'

/**
 * The whole gambit at once (docs/design-system.md §3, `GambitTree`).
 *
 * **Every node is a link.** Not a button, not a click handler on a box: a real `<a href>`
 * that can be middle-clicked into a new tab, copied out of a context menu and found again
 * in history (§4, AC 2). Every position in this product is a URL, and the tree is the view
 * that makes that obvious — it is a map of addresses, and the address is the whole point.
 *
 * Three presentations, one component (§1, AC 3). Which one is in use is a fact about the
 * viewport, so it is read from `matchMedia` rather than guessed from a user agent, and the
 * two breakpoints it asks about are the two the stylesheet uses — `tree-layout.test.ts`
 * fails if they ever stop being the same two.
 */
export type GambitTreeProps = {
  readonly entry: CompiledEntry
  /** The plies the URL asked for, already shape-checked by `parseLine`. */
  readonly requested: readonly string[]
}

const modeNow = (): TreeMode => {
  if (window.matchMedia(minWidthQuery(treeBreakpoints.wide)).matches) return 'full'
  return window.matchMedia(minWidthQuery(treeBreakpoints.medium)).matches
    ? 'collapsible'
    : 'overlay'
}

const subscribeToWidth = (onChange: () => void): (() => void) => {
  const lists = [treeBreakpoints.wide, treeBreakpoints.medium].map((width) =>
    window.matchMedia(minWidthQuery(width)),
  )
  for (const list of lists) list.addEventListener('change', onChange)
  return () => {
    for (const list of lists) list.removeEventListener('change', onChange)
  }
}

/**
 * Which of §1's three layouts applies, kept in step with the viewport.
 *
 * `useSyncExternalStore` rather than an effect and a piece of state, because the snapshot
 * is a plain string the browser already knows: there is no render in which the component
 * believes it is inline while the stylesheet has already made it an overlay.
 */
const useTreeMode = (): TreeMode => useSyncExternalStore(subscribeToWidth, modeNow)

/** Everything in the overlay that can take focus, in order, ignoring the roving `-1`s. */
const focusableIn = (root: HTMLElement): readonly HTMLElement[] =>
  [...root.querySelectorAll('a[href], button, input, [tabindex]')].filter(
    (element): element is HTMLElement => element instanceof HTMLElement && element.tabIndex >= 0,
  )

export const GambitTree = ({ entry, requested }: GambitTreeProps) => {
  const { pathname } = useLocation()
  const translated = useTranslated()
  const mode = useTreeMode()
  const titleId = useId()
  const overlayTitleId = useId()
  const panelId = useId()

  /** Null until the visitor decides, so each layout keeps its own sensible default. */
  const [opened, setOpened] = useState<boolean | null>(null)
  const [refutation, setRefutation] = useState(false)
  const [focusedKey, setFocusedKey] = useState<string | null>(null)

  const toggleRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const itemRefs = useRef(new Map<string, HTMLAnchorElement>())

  const chain = useMemo(() => layoutTree(entry.tree), [entry.tree])
  const items = useMemo(() => flattenChain(chain), [chain])
  const currentKey = useMemo(
    () => resolvePath(entry.tree, requested).path.join('_'),
    [entry.tree, requested],
  )

  /*
   * Open by default where §1 calls the tree collapsible — there it is a disclosure the
   * visitor may close — and closed where §1 calls it a summary, because a summary that
   * starts expanded is not one.
   */
  const open = mode === 'full' || (opened ?? mode === 'collapsible')
  const overlaid = mode === 'overlay' && open

  /*
   * The tab stop follows focus while the visitor is in the tree, and follows the URL
   * otherwise. Validated against the items rather than trusted, so a tree that changes
   * under a remembered key recovers to the current node instead of losing its tab stop.
   */
  const activeKey =
    focusedKey !== null && items.some((item) => item.key === focusedKey) ? focusedKey : currentKey

  const register =
    (key: string) =>
    (element: HTMLAnchorElement | null): void => {
      if (element === null) itemRefs.current.delete(key)
      else itemRefs.current.set(key, element)
    }

  const onTreeKeyDown = (event: KeyboardEvent<HTMLUListElement>): void => {
    if (!treeNavigationKeys.has(event.key) || event.altKey || event.ctrlKey || event.metaKey) return

    /*
     * Taken from the page even where the tree has nowhere to go. The learning surface
     * steps the line on Left and Right (#8) from a window listener that checks
     * `defaultPrevented` first, so without this an arrow pressed inside the tree would
     * move the cursor *and* leave the position — two things from one press.
     */
    event.preventDefault()

    const index = items.findIndex((item) => item.key === activeKey)
    const target = arrowTarget(event.key, items, index === -1 ? 0 : index)
    if (target !== undefined) itemRefs.current.get(target.key)?.focus()
  }

  /*
   * WCAG 2.2 2.4.11, the opening half (AC 4). Focus moves into the overlay as it appears,
   * so the element that has focus is on top of the thing covering the page rather than
   * underneath it. It is also where a visitor who opened the tree by mistake needs to be.
   */
  useEffect(() => {
    if (overlaid) closeRef.current?.focus()
  }, [overlaid])

  const close = (): void => {
    setOpened(false)
    // WCAG 2.2 2.4.11: focus comes back to the control that opened the overlay, which is
    // in the page rather than under the thing that has just been taken away (AC 4).
    toggleRef.current?.focus()
  }

  const onOverlayKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
      return
    }
    if (event.key !== 'Tab') return

    /*
     * The overlay covers the page, so anything behind it that took focus would be focus
     * the visitor cannot see — the same failure 2.4.11 names, arrived at by tabbing
     * instead of by opening. `aria-modal` says so to a screen reader; this is what makes
     * it true for a keyboard.
     */
    const focusable = focusableIn(event.currentTarget)
    const first = focusable[0]
    const last = focusable.at(-1)
    if (first === undefined || last === undefined) return

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const marker = (item: TreeItem): ReactNode => {
    if (item.leaf === null) return null
    const { symbol, label } = leafMarkers[item.leaf]
    const { outcome } = item.node

    return (
      <span className={`gambit-tree__marker gambit-tree__marker--${item.leaf}`}>
        <span className="gambit-tree__symbol" aria-hidden="true">
          {symbol}
        </span>
        <Translated id={label} />
        {outcome?.kind === 'mate' && ` ${outcome.inMoves}`}
      </span>
    )
  }

  /**
   * The proved refutation, behind the control AC 5 asks for and hidden by default.
   *
   * It is text inside the leaf rather than a row of nodes, and that is not a shortcut: the
   * net is proved in a certificate and its positions are not addresses in this gambit, so
   * drawing them as nodes would draw boxes that no URL opens — in the one view whose
   * argument is that every node is a link.
   */
  const proof = (item: TreeItem): ReactNode => {
    const { outcome } = item.node
    if (!refutation || outcome?.kind !== 'mate') return null

    return (
      <span className="gambit-tree__proof">
        <Translated id="tree.refutation" />{' '}
        <span className="gambit-tree__sequence">{outcome.sequence.join(' ')}</span>
      </span>
    )
  }

  const node = (item: TreeItem): ReactNode => {
    const current = item.key === currentKey
    const { ply } = item.node

    return (
      <Link
        key={item.key}
        ref={register(item.key)}
        className={`gambit-tree__node${current ? ' gambit-tree__node--current' : ''}`}
        to={{ pathname, search: lineSearch(item.path) }}
        role="treeitem"
        aria-level={item.level}
        aria-setsize={item.setSize}
        aria-posinset={item.posInSet}
        aria-current={current ? 'true' : undefined}
        tabIndex={item.key === activeKey ? 0 : -1}
        onFocus={() => setFocusedKey(item.key)}
      >
        <span className="gambit-tree__ply">
          {ply === undefined
            ? translated('learn.startingPosition').text
            : plyLabel(ply, item.node.fen)}
        </span>
        {marker(item)}
        {proof(item)}
      </Link>
    )
  }

  /**
   * One chain: its plies along a row, and its branches indented under the last of them.
   *
   * Every node carries its own `aria-level`, `aria-setsize` and `aria-posinset`, which is
   * the documented answer for a tree whose DOM does not mirror its structure — and this
   * one deliberately does not, because collapsing a chain of forced plies onto a row puts
   * six levels of the tree inside one `<li>`.
   *
   * An earlier version made the ownership explicit with `aria-owns` on the last ply of the
   * chain, which is what the APG's navigation treeview does. It is wrong here, and
   * measurably so: a treeitem takes its name from its content, an owned group counts as
   * content, and the root node came out named "Starting position 6...Bxd1 Mate in 2
   * 6...Nxe5 7.Qxh5 …" — the entire tree, read out on every node above a branch.
   */
  const branch = (drawn: TreeChain): ReactNode => (
    <li className="gambit-tree__chain" role="none" key={drawn.items[0]?.key ?? ''}>
      <div className="gambit-tree__plies" role="none">
        {drawn.items.map(node)}
      </div>
      {drawn.branches.length > 0 && (
        <ul className="gambit-tree__branches" role="group">
          {drawn.branches.map(branch)}
        </ul>
      )}
    </li>
  )

  const panel = (
    <div className="gambit-tree__panel" id={panelId}>
      {items.some((item) => item.leaf === 'mate') && (
        <div className="gambit-tree__refutation">
          <input
            type="checkbox"
            id={`${panelId}-refutation`}
            className="gambit-tree__checkbox"
            checked={refutation}
            onChange={(event) => setRefutation(event.currentTarget.checked)}
          />
          <label htmlFor={`${panelId}-refutation`} className="gambit-tree__checkbox-label">
            <Translated id="tree.showRefutation" />
          </label>
        </div>
      )}

      <ul
        className="gambit-tree__root"
        role="tree"
        aria-label={translated('tree.label').text}
        onKeyDown={onTreeKeyDown}
      >
        {branch(chain)}
      </ul>
    </div>
  )

  return (
    <section className="gambit-tree" aria-labelledby={titleId}>
      <p className="gambit-tree__title" id={titleId}>
        <Translated id="tree.heading" />
      </p>

      {/*
       * The summary §1 asks for below 768px, and it is worth having at every width: the
       * shape of a gambit is a count of positions and of lines before it is a picture.
       */}
      <p className="gambit-tree__summary">
        <Translated id="tree.positions" />{' '}
        <span className="gambit-tree__count">{items.length}</span>
        {' · '}
        <Translated id="tree.lines" />{' '}
        <span className="gambit-tree__count">{countLines(chain)}</span>
      </p>

      {mode !== 'full' && (
        <button
          type="button"
          className="gambit-tree__toggle"
          ref={toggleRef}
          aria-expanded={mode === 'collapsible' ? open : undefined}
          aria-controls={mode === 'collapsible' && open ? panelId : undefined}
          onClick={() => setOpened(!open)}
        >
          <Translated id={open ? 'tree.hide' : 'tree.show'} />
        </button>
      )}

      {overlaid ? (
        <div
          className="gambit-tree__overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby={overlayTitleId}
          onKeyDown={onOverlayKeyDown}
        >
          <div className="gambit-tree__overlay-bar">
            <h2 className="gambit-tree__overlay-title" id={overlayTitleId}>
              <Translated id="tree.heading" />
            </h2>
            <button type="button" className="gambit-tree__close" ref={closeRef} onClick={close}>
              <Translated id="tree.close" />
            </button>
          </div>
          {panel}
        </div>
      ) : (
        open && panel
      )}
    </section>
  )
}
