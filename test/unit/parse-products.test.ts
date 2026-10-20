import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseProducts } from '../../server/utils/parse-products'
import { slugify } from '../../shared/utils/slugify'

const HEADER = 'name,manufacturer,price,description,category'

describe('slugify', () => {
  it.each([
    ['EcoCharge HomeVault 10', 'ecocharge-homevault-10'],
    ['SafeLock Pro Pair M/F', 'safelock-pro-pair-m-f'],
    ['QuickLink MC3 Set (10-pack)', 'quicklink-mc3-set-10-pack'],
    ['  Ünïcode — Name  ', 'unicode-name'],
  ])('%s → %s', (input, expected) => {
    expect(slugify(input)).toBe(expected)
  })
})

describe('parseProducts', () => {
  it('parses quoted fields with commas and normalizes values', () => {
    const csv = `${HEADER}\nSolarix Prime 450,Solarix,279.99,"A 450W panel, all black",solar panel\n`
    const { products, skipped } = parseProducts(csv)

    expect(skipped).toEqual([])
    expect(products).toEqual([{
      id: 'solarix-prime-450',
      name: 'Solarix Prime 450',
      manufacturer: 'Solarix',
      manufacturerSlug: 'solarix',
      price: 279.99,
      description: 'A 450W panel, all black',
      category: 'solar-panel',
      spec: { value: 450, unit: 'W', source: 'name+description' },
    }])
  })

  it('skips invalid rows and reports why', () => {
    const csv = [
      HEADER,
      ',NoName,1,d,battery',
      'Bad Price,X,abc,d,battery',
      'Negative,X,-5,d,battery',
      'Unknown,X,5,d,inverter',
      'Good,X,5,d,connector',
    ].join('\n')
    const { products, skipped } = parseProducts(csv)

    expect(products.map(p => p.name)).toEqual(['Good'])
    expect(skipped).toEqual([
      'line 2: missing name or manufacturer',
      'line 3: invalid price "abc"',
      'line 4: invalid price "-5"',
      'line 5: unknown category "inverter"',
    ])
  })

  it('keeps ids unique for duplicate names', () => {
    const csv = `${HEADER}\nSame,X,1,d,connector\nSame,Y,2,d,connector\n`
    expect(parseProducts(csv).products.map(p => p.id)).toEqual(['same', 'same-2'])
  })

  describe('with the real products.csv', () => {
    const csv = readFileSync(new URL('../../server/assets/products.csv', import.meta.url), 'utf8')
    const { products, skipped } = parseProducts(csv)

    it('parses all 150 products without skipping any', () => {
      expect(skipped).toEqual([])
      expect(products).toHaveLength(150)
      expect(new Set(products.map(p => p.id)).size).toBe(150)
    })

    it('extracts a spec matching the name for every battery and panel', () => {
      for (const product of products.filter(p => p.category !== 'connector')) {
        expect(product.spec?.value, product.name).toBe(Number(product.name.split(' ').at(-1)))
      }
    })

    it('has no spec for connectors', () => {
      expect(products.filter(p => p.category === 'connector').every(p => p.spec === null)).toBe(true)
    })
  })
})
