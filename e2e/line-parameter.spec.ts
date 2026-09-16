import { expect, test } from '@playwright/test'
import { lineSearch } from '../src/lib/line.ts'

/**
 * The `line` parameter through a real browser, which is where the encoding actually has
 * to hold: a `+` decoded as a space or a `#` swallowed as a fragment happens in the URL
 * bar, not in a unit test.
 *
 * Note the status codes below. No gambit is published yet (`publishedGambitIds` is empty
 * until #12), so a gambit path has no shell and is served by `404.html` — which boots
 * the same application and routes correctly. That is ADR-0009 working: the status is
 * honest about the page not existing, and the visitor still gets a page.
 */

const matePath = ['Nxe5', 'Bxd1', 'Bxf7+', 'Ke7', 'Nd5#']

test('a link to a proved checkmate restores its exact line', async ({ page }) => {
  await page.goto(`vi/gambits/evans-gambit${lineSearch(matePath)}`)

  await expect(page.getByTestId('line-plies')).toHaveText(matePath.join(' '))
})

test('the encoded line survives a full page reload', async ({ page }) => {
  await page.goto(`vi/gambits/evans-gambit${lineSearch(matePath)}`)
  await page.reload()

  await expect(page.getByTestId('line-plies')).toHaveText(matePath.join(' '))
})

test('an unencoded link recovers to the nearest valid node and says what was wrong', async ({
  page,
}) => {
  // Exactly the corruption CONTEXT.md documents: `+` arrives as a space and everything
  // from `#` onwards never reaches the server at all.
  await page.goto('vi/gambits/evans-gambit?line=Nxe5_Bxd1_Bxf7+_Ke7_Nd5#')

  await expect(page.getByTestId('line-plies')).toHaveText('Nxe5 Bxd1')
  await expect(page.getByRole('alert')).toContainText('is not a move')
})

test('a hostile line neither throws nor blanks the page', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('vi/gambits/evans-gambit?line=%3Cscript%3Ealert(1)%3C%2Fscript%3E')

  await expect(page.getByRole('heading', { level: 1, name: 'evans-gambit' })).toBeVisible()
  await expect(page.getByTestId('line-plies')).toHaveText('the gambit root')
  await expect(page.getByRole('alert')).toBeVisible()
  expect(errors).toEqual([])
})

test('a missing line parameter reads as the gambit root', async ({ page }) => {
  await page.goto('vi/gambits/evans-gambit')

  await expect(page.getByTestId('line-plies')).toHaveText('the gambit root')
  await expect(page.getByRole('alert')).toHaveCount(0)
})
