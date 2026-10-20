import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

/** Interacting before hydration would hit plain HTML without Vue handlers. */
async function waitForHydration(page: Page) {
  await page.waitForFunction(() => {
    const app = (document.querySelector('#__nuxt') as { __vue_app__?: { $nuxt?: { isHydrating?: boolean } } } | null)?.__vue_app__
    return app?.$nuxt?.isHydrating === false
  })
}

async function snapshot(page: Page) {
  return {
    url: page.url(),
    heading: await page.getByRole('heading', { level: 1 }).textContent(),
    count: await page.locator('header p[aria-live]').textContent(),
    products: await page.locator('article h2').allTextContents(),
  }
}

test('filters set in the UI survive a reload and are rendered on the server', async ({ page, browser }) => {
  await page.goto('/')
  await waitForHydration(page)

  // Category → manufacturer → capacity → sort, each step reflected in the URL.
  await page.getByRole('link', { name: /^Batteries/ }).click()
  await expect(page).toHaveURL(/category=battery/)

  await page.getByRole('checkbox', { name: /^EcoCharge/ }).click()
  await expect(page).toHaveURL(/manufacturer=ecocharge/)

  const capacityFrom = page.getByLabel('Capacity from')
  await capacityFrom.fill('7')
  await capacityFrom.press('Enter')
  await expect(page).toHaveURL(/specMin=7/)

  await page.getByRole('combobox', { name: 'Sort products' }).click()
  await page.getByRole('option', { name: 'Capacity: high to low' }).click()
  await expect(page).toHaveURL(/sort=spec-desc/)

  await expect(page.locator('header p[aria-live]')).toHaveText('4 products')
  const before = await snapshot(page)
  expect(before.heading).toBe('EcoCharge Batteries from 7 kWh')
  expect(before.products).toEqual([
    'EcoCharge HomeVault 13.5',
    'EcoCharge HomeVault 12',
    'EcoCharge HomeVault 10',
    'EcoCharge HomeVault 7.5',
  ])

  // Reload: same URL, same results, and the controls show the restored state.
  await page.reload()
  await waitForHydration(page)
  expect(await snapshot(page)).toEqual(before)
  await expect(page.getByRole('checkbox', { name: /^EcoCharge/ })).toBeChecked()
  await expect(page.getByLabel('Capacity from')).toHaveValue('7')
  await expect(page.getByRole('combobox', { name: 'Sort products' })).toContainText('Capacity: high to low')

  // The same link without JavaScript gives the same results – they come from SSR.
  const noJs = await browser.newContext({ javaScriptEnabled: false })
  const ssrPage = await noJs.newPage()
  await ssrPage.goto(before.url)
  expect(await ssrPage.locator('article h2').allTextContents()).toEqual(before.products)
  await expect(ssrPage).toHaveTitle('EcoCharge Batteries from 7 kWh | sun.store')
  await noJs.close()
})

test('the back button steps through filter changes', async ({ page }) => {
  await page.goto('/?category=solar-panel')
  await waitForHydration(page)
  const panels = await snapshot(page)

  await page.getByRole('checkbox', { name: /^Solarix/ }).click()
  await expect(page).toHaveURL(/manufacturer=solarix/)
  await expect(page.locator('header p[aria-live]')).toHaveText('5 products')

  await page.goBack()
  await expect(page).toHaveURL(/\?category=solar-panel$/)
  await expect(page.locator('header p[aria-live]')).toHaveText('50 products')
  await expect(page.getByRole('checkbox', { name: /^Solarix/ })).not.toBeChecked()
  expect(await snapshot(page)).toEqual(panels)
})
