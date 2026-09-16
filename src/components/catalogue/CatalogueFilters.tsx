import { useId } from 'react'
import './CatalogueFilters.css'
import { Translated } from '../../i18n/Translated.tsx'
import type { TranslationKey } from '../../i18n/translations.ts'
import { useTranslated } from '../../i18n/useTranslated.ts'
import { defaultFilter, tierFloors, type CatalogueFilter, type TierFloor } from './filter.ts'
import { filterParams, maxQueryLength, readFilter, writeFilter } from './filter-url.ts'

/**
 * Search and the four filters. **Writes to the URL, reads from the URL** (§3) — it holds
 * no state of its own, so the address bar and the controls cannot disagree, and the back
 * button steps through filters because it steps through URLs.
 *
 * Every control is a native one: an `input`, three `select`s and a radio group in a
 * `fieldset`. That is the whole of the keyboard work, and it is deliberate rather than
 * lazy. A native select is operable by keyboard, announced with its label and its position
 * in the set, and rendered by the platform's own picker on a phone; a listbox rebuilt out
 * of `div`s would cost a week to reach the same place and would be worse on the one device
 * this product targets.
 *
 * There is no submit button and no debounce. The list updates as the filter changes,
 * because `applyFilter` answers over the whole catalogue well inside the 100ms budget
 * (AC 3, `filter.test.ts`) and a search box that waits feels broken. The form still has an
 * `onSubmit` that does nothing: Enter in a single-input form submits it, and without this
 * the page would reload and throw the view away.
 */
export type CatalogueFiltersProps = {
  readonly filter: CatalogueFilter
  readonly onChange: (filter: CatalogueFilter) => void
}

type Choice = { readonly value: string; readonly key: TranslationKey }

const sideChoices: readonly Choice[] = [
  { value: 'white', key: 'catalogue.white' },
  { value: 'black', key: 'catalogue.black' },
]

const categoryChoices: readonly Choice[] = [
  { value: 'gambit', key: 'catalogue.gambit' },
  { value: 'trap', key: 'catalogue.trap' },
]

const soundnessChoices: readonly Choice[] = [
  { value: 'sound', key: 'soundness.sound' },
  { value: 'dubious', key: 'soundness.dubious' },
  { value: 'unsound', key: 'soundness.unsound' },
]

const depthKeys: Readonly<Record<TierFloor, TranslationKey>> = {
  taught: 'catalogue.depthTaught',
  mapped: 'catalogue.depthMapped',
  all: 'catalogue.depthAll',
}

export const CatalogueFilters = ({ filter, onChange }: CatalogueFiltersProps) => {
  const headingId = useId()
  const queryId = useId()
  const hintId = useId()
  const sideId = useId()
  const categoryId = useId()
  const soundnessId = useId()
  const depthName = useId()

  /**
   * Option text comes through `useTranslated` rather than `Translated`, for the reason
   * that component gives about attributes: an `option` may contain text and nothing else,
   * so there is nowhere inside one to put the visible untranslated marker. The marker on
   * the select's own label is what reports the gap.
   */
  const translated = useTranslated()
  const any = translated('catalogue.any').text

  /**
   * A closed-set control changes one URL parameter, and the filter is then re-read from
   * the parameters rather than written onto the filter object directly. One code path, so
   * a control can only ever produce a filter a URL could also produce — and a value this
   * build does not recognise degrades to "not filtered" here by exactly the same line as
   * one typed into the address bar.
   */
  const setParam = (name: string, value: string): void => {
    const params = writeFilter(filter)
    if (value === '') params.delete(name)
    else params.set(name, value)
    onChange(readFilter(params))
  }

  /** `writeFilter` omits every default, so an empty query string *is* the default view. */
  const changed = writeFilter(filter).toString() !== ''

  const select = (
    id: string,
    labelKey: TranslationKey,
    param: string,
    value: string,
    choices: readonly Choice[],
  ) => (
    <p className="catalogue-filters__field">
      <label htmlFor={id}>
        <Translated id={labelKey} />
      </label>
      <select
        id={id}
        className="catalogue-filters__select"
        value={value}
        onChange={(event) => setParam(param, event.target.value)}
      >
        <option value="">{any}</option>
        {choices.map((choice) => (
          <option key={choice.value} value={choice.value}>
            {translated(choice.key).text}
          </option>
        ))}
      </select>
    </p>
  )

  return (
    <form
      className="catalogue-filters"
      role="search"
      aria-labelledby={headingId}
      onSubmit={(event) => event.preventDefault()}
    >
      <h2 className="catalogue-filters__heading" id={headingId}>
        <Translated id="catalogue.filters" />
      </h2>

      <div className="catalogue-filters__fields">
        <p className="catalogue-filters__field catalogue-filters__field--query">
          <label htmlFor={queryId}>
            <Translated id="catalogue.search" />
          </label>
          <input
            id={queryId}
            className="catalogue-filters__input"
            type="search"
            /**
             * Bounded here as well as in `readFilter`, so the box cannot compose a URL the
             * reader would then truncate. Nothing legitimate comes near the limit.
             */
            maxLength={maxQueryLength}
            value={filter.q}
            aria-describedby={hintId}
            onChange={(event) => onChange({ ...filter, q: event.target.value })}
          />
          <span className="catalogue-filters__hint" id={hintId}>
            <Translated id="catalogue.searchHint" />
          </span>
        </p>

        {select(sideId, 'catalogue.side', filterParams.side, filter.side ?? '', sideChoices)}
        {select(
          categoryId,
          'catalogue.category',
          filterParams.category,
          filter.category ?? '',
          categoryChoices,
        )}
        {select(
          soundnessId,
          'catalogue.soundness',
          filterParams.soundness,
          filter.soundness ?? '',
          soundnessChoices,
        )}
      </div>

      {/*
       * Depth is radios rather than a fourth select, and that is the one place this form
       * spends extra room on purpose. The default is Taught and the breadth of the index
       * is something a visitor *asks for* (AC 5); a choice folded into a closed dropdown
       * is a choice most visitors never see, and "show everything listed" being visible
       * without opening anything is the whole point of the toggle existing.
       */}
      <fieldset className="catalogue-filters__depth">
        <legend>
          <Translated id="catalogue.depth" />
        </legend>
        {tierFloors.map((floor) => (
          <label className="catalogue-filters__radio" key={floor}>
            <input
              type="radio"
              name={depthName}
              value={floor}
              checked={filter.tier === floor}
              onChange={() => setParam(filterParams.tier, floor)}
            />
            <Translated id={depthKeys[floor]} />
          </label>
        ))}
      </fieldset>

      {/*
       * Offered only when there is something to clear. A control that is always present
       * and usually does nothing is a control people stop reading.
       */}
      {changed && (
        <button
          type="button"
          className="catalogue-filters__clear"
          onClick={() => onChange(defaultFilter)}
        >
          <Translated id="catalogue.clear" />
        </button>
      )}
    </form>
  )
}
