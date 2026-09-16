import { Link } from 'react-router'
import './Footer.css'
import type { Locale } from '../../lib/locale.ts'
import { routePath, routeSegments } from '../../lib/routes.ts'

type FooterProps = { readonly locale: Locale }

const repository = 'https://github.com/chan-nguyen/chess-gambits'

/**
 * The two licences are separate and both are named, because they differ: the application
 * is MIT and the chess content is CC BY-SA 4.0, so reusing an annotation carries an
 * obligation that reusing the code does not (`LICENSE-CONTENT`).
 *
 * The opening dataset is CC0 and imposes no attribution requirement. It is credited
 * anyway — ADR-0008 says so in as many words, and it costs nothing.
 */
export const Footer = ({ locale }: FooterProps) => (
  <footer className="site-footer">
    <ul className="site-footer__list">
      <li>
        <a href={repository}>Source on GitHub</a>
      </li>
      <li>
        Code: <a href={`${repository}/blob/main/LICENSE`}>MIT</a>
      </li>
      <li>
        Content: <a href={`${repository}/blob/main/LICENSE-CONTENT`}>CC BY-SA 4.0</a>
      </li>
      <li>
        Opening names and ECO codes from{' '}
        <a href="https://github.com/lichess-org/chess-openings">lichess-org/chess-openings</a>, CC0
      </li>
      <li>
        <Link to={routePath(locale, routeSegments.about)}>How mate claims are proved</Link>
      </li>
    </ul>
  </footer>
)
