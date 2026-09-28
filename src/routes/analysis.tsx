import { useEffect, useMemo } from 'react'
import './analysis.css'
import { AnalysisSurface } from '../components/analysis/AnalysisSurface.tsx'
import {
  createStockfishSource,
  stockfishWorkerPath,
} from '../components/analysis/stockfish-source.ts'
import { Translated } from '../i18n/Translated.tsx'
import { withBasePath } from '../lib/base-path.ts'

/**
 * `/:locale/analysis` (#154). The route owns the engine's lifetime: one worker for as long
 * as the page is open, started by the first position it is asked about and terminated when
 * the visitor leaves, so a closed analysis page leaves nothing running in the background.
 */
export const AnalysisRoute = () => {
  const source = useMemo(() => createStockfishSource(withBasePath(stockfishWorkerPath)), [])
  useEffect(() => () => source.dispose(), [source])

  return (
    <main className="analysis">
      <h1>
        <Translated id="analysis.heading" />
      </h1>
      <p className="analysis__intro">
        <Translated id="analysis.intro" />
      </p>
      <AnalysisSurface source={source} />
    </main>
  )
}
