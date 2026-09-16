import { createContext, useContext } from 'react'
import type { LocaleBundleStatus } from './i18n.ts'

/**
 * Whether the active locale's catalogue actually arrived, for the one component that has
 * to say so out loud (`LocaleBundleNotice`).
 *
 * Deliberately *not* what `useTranslated` consults. That hook reads the i18next instance
 * directly, so a string and its marker can never be decided by two different sources a
 * render apart.
 *
 * The default is `ready`, which is what a component rendered outside the provider — in a
 * focused unit test, say — should assume: no notice, and markers behave normally.
 */
export const LocaleBundleContext = createContext<LocaleBundleStatus>('ready')

export const useLocaleBundleStatus = (): LocaleBundleStatus => useContext(LocaleBundleContext)
