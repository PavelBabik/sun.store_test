import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { filterProducts } from '../../server/utils/filter-products'
import { parseProducts } from '../../server/utils/parse-products'
import { parseProductQuery } from '../../shared/utils/product-query'
import { buildListingSeo } from '../../shared/utils/seo'

const csv = readFileSync(new URL('../../server/assets/products.csv', import.meta.url), 'utf8')
const { products } = parseProducts(csv)
const seoFor = (raw: Record<string, unknown>) => buildListingSeo(filterProducts(products, parseProductQuery(raw)))

describe('buildListingSeo', () => {
  it('indexes the full listing with a self canonical', () => {
    expect(seoFor({})).toMatchObject({
      heading: 'Solar products',
      title: 'Solar products | sun.store',
      robots: 'index, follow',
      canonicalQuery: {},
    })
  })

  it('describes a category with real numbers', () => {
    const seo = seoFor({ category: 'battery' })
    expect(seo.title).toBe('Batteries | sun.store')
    expect(seo.description).toContain('Compare 50 batteries')
    expect(seo.description).toContain('€299.99–€1,999.00')
    expect(seo.canonicalQuery).toEqual({ category: 'battery' })
  })

  it('indexes a category with one manufacturer and names it', () => {
    const seo = seoFor({ category: 'battery', manufacturer: 'ecocharge' })
    expect(seo.heading).toBe('EcoCharge Batteries')
    expect(seo.robots).toBe('index, follow')
    expect(seo.description).toContain('from EcoCharge')
  })

  it('canonicalizes sorted URLs to the unsorted one and keeps the page', () => {
    const seo = seoFor({ category: 'solar-panel', sort: 'price-asc', page: '2' })
    expect(seo.title).toBe('Solar panels – Page 2 | sun.store')
    expect(seo.canonicalQuery).toEqual({ category: 'solar-panel', page: '2' })
  })

  it.each([
    [{ q: 'mc4' }, '“mc4” in Solar products'],
    [{ manufacturer: ['ecocharge', 'gridcore'] }, 'Solar products'],
    [{ category: 'battery', specMin: '10', specMax: '15' }, 'Batteries 10–15 kWh'],
    [{ category: 'solar-panel', specMin: '500' }, 'Solar panels from 500 W'],
    [{ priceMax: '100' }, 'Solar products, up to €100.00'],
  ])('does not index filter combination %j', (raw, heading) => {
    const seo = seoFor(raw)
    expect(seo.heading).toBe(heading)
    expect(seo.robots).toBe('noindex, follow')
    expect(seo.canonicalQuery).toBeNull()
  })

  it('does not index empty results', () => {
    expect(seoFor({ category: 'battery', priceMax: '1' })).toMatchObject({
      robots: 'noindex, follow',
      description: 'No products match these filters on sun.store. Try removing some filters.',
    })
  })
})
