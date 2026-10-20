import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { filterProducts, searchScore } from '../../server/utils/filter-products'
import { parseProducts } from '../../server/utils/parse-products'
import { PAGE_SIZE, parseProductQuery } from '../../shared/utils/product-query'
import type { Product } from '../../shared/types/product'
import { slugify } from '../../shared/utils/slugify'

function product(name: string, overrides: Partial<Product> = {}): Product {
  const manufacturer = overrides.manufacturer ?? 'Acme'
  return {
    id: slugify(name),
    name,
    manufacturer,
    manufacturerSlug: slugify(manufacturer),
    price: 100,
    description: '',
    category: 'connector',
    spec: null,
    ...overrides,
  }
}

const battery = (name: string, kWh: number, price: number, manufacturer = 'Acme') =>
  product(name, { category: 'battery', price, manufacturer, spec: { value: kWh, unit: 'kWh', source: 'name+description' } })
const panel = (name: string, watts: number, price: number, manufacturer = 'Acme') =>
  product(name, { category: 'solar-panel', price, manufacturer, spec: { value: watts, unit: 'W', source: 'name+description' } })

const PRODUCTS: Product[] = [
  battery('Vault 5', 5, 700, 'EcoCharge'),
  battery('Vault 10', 10, 1400, 'EcoCharge'),
  battery('Bank 7', 7, 1000, 'Quantum Energy'),
  panel('Prime 450', 450, 280, 'Solarix'),
  panel('Prime 400', 400, 230, 'Solarix'),
  product('MC4 Fuse 15A', { price: 15, manufacturer: 'SafeLock', description: 'Inline fuse for solar strings' }),
  product('MC4 Wrench', { price: 9, manufacturer: 'QuickLink', description: 'Tool for MC4 connectors' }),
]

const run = (raw: Record<string, unknown>, products = PRODUCTS) => filterProducts(products, parseProductQuery(raw))
const names = (raw: Record<string, unknown>) => run(raw).items.map(p => p.name)

describe('searchScore', () => {
  const fuse = PRODUCTS[5]!

  it('requires every token to match somewhere', () => {
    expect(searchScore(fuse, ['mc4', 'fuse'])).toBeGreaterThan(0)
    expect(searchScore(fuse, ['mc4', 'battery'])).toBe(0)
  })

  it('weighs name > manufacturer > description', () => {
    expect(searchScore(fuse, ['fuse'])).toBe(3 + 1) // name + description
    expect(searchScore(fuse, ['safelock'])).toBe(2)
    expect(searchScore(fuse, ['strings'])).toBe(1)
  })

  it('ignores case and diacritics', () => {
    expect(searchScore(product('Ünïcode Panel'), ['unicode'])).toBeGreaterThan(0)
  })
})

describe('filterProducts', () => {
  it('returns everything in source order by default', () => {
    expect(run({}).total).toBe(PRODUCTS.length)
    expect(names({})).toEqual(PRODUCTS.map(p => p.name))
  })

  it('searches name, manufacturer and description, best match first', () => {
    // The wrench mentions MC4 in the name *and* the description, so it outranks the fuse.
    expect(names({ q: 'mc4' })).toEqual(['MC4 Wrench', 'MC4 Fuse 15A'])
    expect(names({ q: 'quantum' })).toEqual(['Bank 7'])
    expect(names({ q: 'strings' })).toEqual(['MC4 Fuse 15A'])
    expect(names({ q: 'fuse mc4' })).toEqual(['MC4 Fuse 15A'])
  })

  it('filters by category, manufacturer and price', () => {
    expect(names({ category: 'battery' })).toEqual(['Vault 5', 'Vault 10', 'Bank 7'])
    expect(names({ manufacturer: ['ecocharge', 'solarix'] })).toEqual(['Vault 5', 'Vault 10', 'Prime 450', 'Prime 400'])
    expect(names({ priceMin: '200', priceMax: '1000' })).toEqual(['Vault 5', 'Bank 7', 'Prime 450', 'Prime 400'])
  })

  it('filters by spec within a category, inclusive bounds', () => {
    expect(names({ category: 'battery', specMin: '7', specMax: '10' })).toEqual(['Vault 10', 'Bank 7'])
    expect(names({ category: 'solar-panel', specMin: '420' })).toEqual(['Prime 450'])
  })

  it('sorts by price and spec', () => {
    expect(names({ category: 'battery', sort: 'price-desc' })).toEqual(['Vault 10', 'Bank 7', 'Vault 5'])
    expect(names({ category: 'battery', sort: 'spec-asc' })).toEqual(['Vault 5', 'Bank 7', 'Vault 10'])
    expect(names({ q: 'mc4', sort: 'price-asc' })).toEqual(['MC4 Wrench', 'MC4 Fuse 15A'])
  })

  it('puts products without a spec last in both directions', () => {
    for (const sort of ['spec-asc', 'spec-desc']) {
      const items = run({ sort }).items
      expect(items.slice(-2).every(p => p.spec === null), sort).toBe(true)
    }
  })

  it('paginates and clamps the page to the last one', () => {
    const many = Array.from({ length: PAGE_SIZE + 5 }, (_, i) => product(`Item ${i + 1}`))
    const page2 = run({ page: '2' }, many)
    expect(page2).toMatchObject({ total: PAGE_SIZE + 5, page: 2, pageCount: 2 })
    expect(page2.items.map(p => p.name)).toEqual(many.slice(PAGE_SIZE).map(p => p.name))

    const tooFar = run({ page: '50' }, many)
    expect(tooFar.page).toBe(2)
    expect(tooFar.query.page).toBe(2)
  })

  it('returns an empty result with empty facets when nothing matches', () => {
    const result = run({ q: 'nothing-like-this' })
    expect(result).toMatchObject({ total: 0, items: [], page: 1, pageCount: 1 })
    expect(result.facets.price).toBeNull()
    expect(result.facets.manufacturers).toEqual([])
  })

  describe('facets', () => {
    it('counts manufacturers ignoring the manufacturer filter itself', () => {
      const { facets } = run({ category: 'battery', manufacturer: 'ecocharge' })
      expect(facets.manufacturers).toEqual([
        { value: 'ecocharge', label: 'EcoCharge', count: 2 },
        { value: 'quantum-energy', label: 'Quantum Energy', count: 1 },
      ])
    })

    it('keeps a selected manufacturer visible with a zero count', () => {
      const { facets } = run({ category: 'solar-panel', manufacturer: 'ecocharge' })
      expect(facets.manufacturers).toContainEqual({ value: 'ecocharge', label: 'EcoCharge', count: 0 })
    })

    it('counts categories as "results after switching", without the spec bounds of the current one', () => {
      const { facets } = run({ category: 'battery', specMin: '8' })
      expect(facets.categories).toEqual([
        { value: 'battery', label: 'Batteries', count: 1 },
        { value: 'connector', label: 'Connectors', count: 2 },
        { value: 'solar-panel', label: 'Solar panels', count: 2 },
      ])
    })

    it('computes each range facet ignoring its own filter but applying the others', () => {
      const { facets } = run({ category: 'battery', priceMax: '1000', specMin: '6' })
      // price: batteries with ≥ 6 kWh → Bank 7 (1000), Vault 10 (1400)
      expect(facets.price).toEqual({ min: 1000, max: 1400 })
      // spec: batteries up to 1000 EUR → Vault 5 (5 kWh), Bank 7 (7 kWh)
      expect(facets.spec).toEqual({ min: 5, max: 7, unit: 'kWh' })
    })

    it('has no spec facet without a category or for connectors', () => {
      expect(run({}).facets.spec).toBeNull()
      expect(run({ category: 'connector' }).facets.spec).toBeNull()
    })
  })

  describe('with the real products.csv', () => {
    const csv = readFileSync(new URL('../../server/assets/products.csv', import.meta.url), 'utf8')
    const { products } = parseProducts(csv)

    it('finds batteries between 10 and 13.5 kWh', () => {
      const result = run({ category: 'battery', specMin: '10', specMax: '13.5' }, products)
      expect(result.total).toBe(15)
      expect(result.items.every(p => p.spec !== null && p.spec.value >= 10 && p.spec.value <= 13.5)).toBe(true)
    })

    it('sorts panels by power descending', () => {
      const watts = run({ category: 'solar-panel', sort: 'spec-desc' }, products).items.map(p => p.spec?.value)
      expect(watts[0]).toBe(600)
      expect(watts).toEqual([...watts].sort((a, b) => (b ?? 0) - (a ?? 0)))
    })
  })
})
