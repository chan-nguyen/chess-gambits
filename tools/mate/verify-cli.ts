import { readFileSync } from 'node:fs'
import { certificateFilesUnder, claimsUnder } from './corpus.ts'
import { describeFailure, verifyCertificate } from './verify.ts'

/**
 * `npm run verify:mates` — replay every committed certificate, using `chess.js` and nothing
 * else. **A required CI step.**
 *
 * It imports no engine, directly or transitively (`no-engine.test.ts` asserts it by walking
 * the import graph), and it does no searching beyond the bounded minimality check. What it
 * does is replay: the game from the standard start position, then every move of the net,
 * against the rules. That is why it costs milliseconds while the thing that produced its
 * input costs minutes.
 *
 * It also checks the corpus for holes in both directions, because either one is a published
 * claim nobody checked:
 *
 * - a leaf claiming a trap with no certificate beside it, and
 * - a certificate that no leaf claims, which is a proof of something the site is no longer
 *   saying and has stopped being verified against anything.
 *
 * The default targets deliberately include the fixture corpus. A command that passes because
 * it found nothing to check is the failure mode this project keeps rediscovering, so this
 * one always has real certificates in front of it.
 */

const DEFAULT_TARGETS: readonly string[] = ['content', 'tools/mate/fixtures/valid']

const run = (argv: readonly string[]): number => {
  const targets = argv.length > 0 ? argv : DEFAULT_TARGETS
  const started = Date.now()

  let certificates: readonly string[]
  let claimed
  try {
    certificates = targets.flatMap((target) => certificateFilesUnder(target))
    claimed = claimsUnder(targets)
  } catch {
    process.stderr.write(`verify:mates: cannot read ${targets.join(', ')}\n`)
    return 1
  }

  const claims = claimed.flatMap((file) => file.claims)
  let failures = 0
  let nodes = 0

  for (const file of certificates) {
    let value: unknown
    try {
      value = JSON.parse(readFileSync(file, 'utf8'))
    } catch (error) {
      failures += 1
      process.stdout.write(
        `FAIL ${file}\n  [certificate-malformed] not readable as JSON: ${error instanceof Error ? error.message : String(error)}\n\n`,
      )
      continue
    }

    const verification = verifyCertificate(file, value)
    if (!verification.ok) {
      failures += 1
      process.stdout.write(
        `FAIL ${file}\n  ${verification.failures.map(describeFailure).join('\n  ')}\n\n`,
      )
      continue
    }

    const proof = verification.proof
    nodes += proof.attackerMoves
    process.stdout.write(
      `ok   ${file}\n` +
        `     mate in ${proof.inMoves} for ${proof.attacker}, ${proof.attackerMoves} attacker move(s) over ${proof.defenderNodes} defender node(s), proved by ${proof.defenderNodes === 0 ? 'search' : 'a modelled net'}\n` +
        `     longest line: ${proof.sequence.join(' ')}\n`,
    )
  }

  const names = new Set(certificates.map((file) => file.split('/').at(-1)))
  const claimNames = new Set(claims.map((claim) => claim.certificate))

  for (const claim of claims) {
    if (names.has(claim.certificate)) continue
    failures += 1
    process.stdout.write(
      `FAIL ${claim.entryId} > ${claim.nodePath.join(' > ')}\n  [missing-certificate] This leaf claims a trap and \`${claim.certificate}\` does not exist. Run \`npm run prove:mates\`.\n\n`,
    )
  }

  for (const file of certificates) {
    const name = file.split('/').at(-1)
    if (name !== undefined && claimNames.has(name)) continue
    failures += 1
    process.stdout.write(
      `FAIL ${file}\n  [orphan-certificate] No leaf claims this proof. A certificate nobody claims is a proof of something the site has stopped saying, and it verifies for ever without anyone reading it. Delete it, or restore the leaf.\n\n`,
    )
  }

  const elapsed = Date.now() - started
  process.stdout.write(
    `\ncertificates ${certificates.length}   claims ${claims.length}   attacker moves replayed ${nodes}   ${elapsed}ms\n`,
  )

  if (certificates.length === 0 && claims.length === 0) {
    process.stdout.write(
      `\nverify:mates: nothing under ${targets.join(', ')} claims or proves a mate. Nothing was checked, which is not the same as everything passing.\n`,
    )
    return 1
  }

  if (failures > 0) {
    process.stdout.write(`\n${failures} certificate(s) or claim(s) rejected.\n`)
    return 1
  }
  process.stdout.write(`\nAll ${certificates.length} certificate(s) verified.\n`)
  return 0
}

process.exitCode = run(process.argv.slice(2))
