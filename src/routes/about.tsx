import { aboutAnchors } from '../components/catalogue/about-anchors.ts'
import { Translated } from '../i18n/Translated.tsx'

/**
 * Placeholder: the real copy is #7 and #17. The dataset credit below is #12 and is not.
 *
 * The two sections added by #13 are not placeholders either. `TierBadge` and
 * `SoundnessBadge` link here (AC 9) and a badge that pointed at a page with no explanation
 * on it would be a link to nothing — so the vocabulary those badges use is defined here,
 * in all three languages, at the anchors the badges name.
 */
export const AboutRoute = () => (
  <main>
    <h1>About</h1>
    <p>What the coverage tiers mean, how mate claims are verified, credits and licences.</p>

    <h2 id={aboutAnchors.tiers}>
      <Translated id="about.tiersHeading" />
    </h2>
    <p>
      <Translated id="about.tiersIntro" />
    </p>
    <ul>
      <li>
        <Translated id="about.tierListed" />
      </li>
      <li>
        <Translated id="about.tierMapped" />
      </li>
      <li>
        <Translated id="about.tierTaught" />
      </li>
    </ul>

    <h2 id={aboutAnchors.soundness}>
      <Translated id="about.soundnessHeading" />
    </h2>
    <p>
      <Translated id="about.soundnessIntro" />
    </p>
    <ul>
      <li>
        <Translated id="about.soundnessSound" />
      </li>
      <li>
        <Translated id="about.soundnessDubious" />
      </li>
      <li>
        <Translated id="about.soundnessUnsound" />
      </li>
    </ul>

    <h2>Credits</h2>
    <p>
      Opening names, ECO codes and defining move sequences come from{' '}
      <a href="https://github.com/lichess-org/chess-openings">lichess-org/chess-openings</a>, which
      its authors dedicate to the public domain under CC0. CC0 asks for no attribution; this credit
      is given anyway, because it costs nothing and the catalogue would be a great deal smaller
      without that work.
    </p>
    <p>
      Everything this site says <em>about</em> an opening — the annotations, the plans, the
      assessments and the soundness labels — is written here from scratch. Named traps are not in
      that dataset and are entered by hand, one at a time.
    </p>
    <p>
      The chess pieces are the <code>celtic</code> set by Maurizio Monge, from{' '}
      <a href="https://github.com/maurimo/chess-art">maurimo/chess-art</a>, used and modified under
      the MIT licence. Copyright (c) Maurizio Monge. Permission is hereby granted, free of charge,
      to any person obtaining a copy of this software and associated documentation files (the
      &ldquo;Software&rdquo;), to deal in the Software without restriction, including without
      limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
      sell copies of the Software, and to permit persons to whom the Software is furnished to do so,
      subject to the following conditions: the above copyright notice and this permission notice
      shall be included in all copies or substantial portions of the Software. The Software is
      provided &ldquo;as is&rdquo;, without warranty of any kind, express or implied, including but
      not limited to the warranties of merchantability, fitness for a particular purpose and
      noninfringement. In no event shall the authors or copyright holders be liable for any claim,
      damages or other liability, whether in an action of contract, tort or otherwise, arising from,
      out of or in connection with the Software or the use or other dealings in the Software. What
      was changed, and which other sets were considered, is recorded in <code>NOTICE</code>.
    </p>
  </main>
)
