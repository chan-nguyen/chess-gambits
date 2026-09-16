import { useId, useState } from 'react'
import './CatalogueList.css'
import { Translated } from '../../i18n/Translated.tsx'
import type { Locale } from '../../lib/locale.ts'
import type { StoredProgress } from '../progress/progress-storage.ts'
import { GambitCard } from './GambitCard.tsx'
import type { IndexedFamily } from './filter.ts'

/**
 * The catalogue itself: **grouped by family, expanded on demand** (AC 4).
 *
 * The grouping is not presentation. The imported dataset is a list of *variations*, so one
 * search term returns dozens of near-identical rows — thirteen of them beginning "Italian
 * Game" — and a flat list of seven hundred of those is unsearchable and reads as a
 * graveyard (docs/CONTEXT.md, *Family*). Collapsed, the same data is forty-seven lines.
 *
 * A closed family renders **no cards at all**, not hidden ones. That is what keeps the
 * unfiltered view cheap: forty-seven buttons instead of seven hundred cards, with no
 * virtualisation and no windowing to get wrong. "Expands on demand" is meant literally.
 *
 * The disclosure is a heading containing a button, which is the pattern assistive
 * technology expects: the family is a level in the page's outline *and* the control that
 * reveals it, and `aria-expanded` says which state it is in. Nothing here is a `details`
 * element, because its open state has to follow the filter and a `details` a component
 * also controls ends up with two answers to whether it is open.
 */
export type CatalogueListProps = {
  readonly locale: Locale
  /** Families with at least one match, each holding only its matches. */
  readonly families: readonly IndexedFamily[]
  /**
   * True when the filter is narrowing the catalogue, in which case the matches are shown
   * rather than hidden behind forty-seven more clicks. Somebody who typed a search term
   * asked to see results; somebody who opened `/gambits` asked to see the index.
   */
  readonly expandByDefault: boolean
  readonly progress: StoredProgress
}

export const CatalogueList = ({
  locale,
  families,
  expandByDefault,
  progress,
}: CatalogueListProps) => {
  const baseId = useId()
  const [toggled, setToggled] = useState<ReadonlySet<string>>(() => new Set())

  /**
   * State adjusted during render rather than in an effect: when the filter starts or stops
   * narrowing, every family goes back to the new default. Without this, a family the
   * visitor collapsed while browsing the index would come back *collapsed* the moment they
   * typed a search term — a set of "the opposite of the default" is only meaningful while
   * the default is the same one it was recorded against.
   */
  const [defaultWas, setDefaultWas] = useState(expandByDefault)
  if (defaultWas !== expandByDefault) {
    setDefaultWas(expandByDefault)
    setToggled(new Set())
  }

  const isOpen = (id: string): boolean => (toggled.has(id) ? !expandByDefault : expandByDefault)

  const toggle = (id: string): void => {
    const next = new Set(toggled)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setToggled(next)
  }

  return (
    <ul className="catalogue-list">
      {families.map(({ family, entries }) => {
        const open = isOpen(family.id)
        const panelId = `${baseId}-${family.id}`

        return (
          <li className="catalogue-family" key={family.id}>
            <h3 className="catalogue-family__heading">
              <button
                type="button"
                className="catalogue-family__toggle"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => toggle(family.id)}
              >
                <span className="catalogue-family__name">{family.name}</span>
                <span className="catalogue-family__count">
                  <Translated id="catalogue.entriesInFamily" values={{ entries: entries.length }} />
                </span>
              </button>
            </h3>

            <ul className="catalogue-family__entries" id={panelId} hidden={!open}>
              {open &&
                entries.map((indexed) => (
                  <GambitCard
                    key={indexed.entry.id}
                    locale={locale}
                    name={indexed.name}
                    entry={indexed.entry}
                    marked={progress[indexed.entry.id]?.length ?? 0}
                  />
                ))}
            </ul>
          </li>
        )
      })}
    </ul>
  )
}
