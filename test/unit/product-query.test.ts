import { describe, expect, it } from 'vitest'
import { canonicalRedirect, DEFAULT_SORT, MAX_SEARCH_LENGTH, parseProductQuery, toRouteQuery } from '../../shared/utils/product-query'

const EMPTY = {
  q: '',
  category: null,
  manufacturers: [],
  priceMin: null,
  priceMax: null,
  specMin: null,
  specMax: null,
  sort: DEFAULT_SORT,
  page: 1,
}

describe('parseProductQuery', () => {
  it('returns defaults for an empty query', () => {
    expect(parseProductQuery({})).toEqual(EMPTY)
  })

  it('parses a full query', () => {
    expect(parseProductQuery({
      q: 'lfp',
      category: 'battery',
      manufacturer: ['EcoCharge', 'quantum-energy'],
      priceMin: '100',
      priceMax: '1500.5',
      specMin: '5',
      specMax: '10',
      sort: 'spec-desc',
      page: '2',
    })).toEqual({
      q: 'lfp',
      category: 'battery',
      manufacturers: ['ecocharge', 'quantum-energy'],
      priceMin: 100,
      priceMax: 1500.5,
      specMin: 5,
      specMax: 10,
      sort: 'spec-desc',
      page: 2,
    })
  })

  it('drops invalid values instead of failing', () => {
    expect(parseProductQuery({
      category: 'inverter',
      sort: 'cheapest',
      page: '-3',
      priceMin: 'abc',
      priceMax: '',
    })).toEqual(EMPTY)
  })

  it('swaps reversed ranges', () => {
    const query = parseProductQuery({ category: 'solar-panel', priceMin: '500', priceMax: '100', specMin: '600', specMax: '400' })
    expect(query).toMatchObject({ priceMin: 100, priceMax: 500, specMin: 400, specMax: 600 })
  })

  it('drops spec bounds and spec sorting without a category that has a spec unit', () => {
    expect(parseProductQuery({ specMin: '5', sort: 'spec-asc' })).toMatchObject({ specMin: null, specMax: null, sort: DEFAULT_SORT })
    expect(parseProductQuery({ category: 'connector', specMin: '5', sort: 'spec-desc' })).toMatchObject({ specMin: null, sort: DEFAULT_SORT })
    expect(parseProductQuery({ category: 'battery', sort: 'spec-desc' }).sort).toBe('spec-desc')
    expect(parseProductQuery({ sort: 'price-desc' }).sort).toBe('price-desc')
  })

  it('normalizes manufacturers: comma lists, slugs, duplicates, order', () => {
    expect(parseProductQuery({ manufacturer: 'SafeLock,pv-link' }).manufacturers).toEqual(['pv-link', 'safelock'])
    expect(parseProductQuery({ manufacturer: ['b', 'a', 'B', ''] }).manufacturers).toEqual(['a', 'b'])
  })

  it('collapses whitespace in the search and limits its length', () => {
    expect(parseProductQuery({ q: '  mc4    fuse ' }).q).toBe('mc4 fuse')
    expect(parseProductQuery({ q: 'x'.repeat(500) }).q).toHaveLength(MAX_SEARCH_LENGTH)
  })

  it('takes the first value of repeated single-value params', () => {
    expect(parseProductQuery({ category: ['battery', 'connector'], page: ['3', '4'] }))
      .toMatchObject({ category: 'battery', page: 3 })
  })

  it('floors fractional pages', () => {
    expect(parseProductQuery({ page: '2.7' }).page).toBe(2)
    expect(parseProductQuery({ page: '0' }).page).toBe(1)
  })
})

describe('toRouteQuery', () => {
  it('omits defaults', () => {
    expect(toRouteQuery(parseProductQuery({}))).toEqual({})
  })

  it('serializes every filter with a stable key order', () => {
    const query = toRouteQuery(parseProductQuery({
      page: '2',
      sort: 'price-asc',
      manufacturer: 'b,a',
      category: 'battery',
      specMax: '10',
      priceMin: '100',
      q: 'lfp',
    }))
    expect(query).toEqual({
      q: 'lfp',
      category: 'battery',
      manufacturer: ['a', 'b'],
      priceMin: '100',
      specMax: '10',
      sort: 'price-asc',
      page: '2',
    })
    expect(Object.keys(query)).toEqual(['q', 'category', 'manufacturer', 'priceMin', 'specMax', 'sort', 'page'])
  })

  it('round-trips through parseProductQuery', () => {
    const query = parseProductQuery({ q: 'mc4', category: 'solar-panel', manufacturer: ['x', 'y'], priceMax: '99.5', specMin: '400', sort: 'spec-desc', page: '3' })
    expect(parseProductQuery(toRouteQuery(query))).toEqual(query)
  })
})

describe('canonicalRedirect', () => {
  const redirect = (raw: Record<string, unknown>, applied = parseProductQuery(raw)) => canonicalRedirect(raw, applied)

  it('returns null for canonical URLs, regardless of key order', () => {
    expect(redirect({})).toBeNull()
    expect(redirect({ page: '2', category: 'battery' })).toBeNull()
    expect(redirect({ manufacturer: ['a', 'b'] })).toBeNull()
  })

  it('ignores and keeps unknown params such as utm_*', () => {
    expect(redirect({ category: 'battery', utm_source: 'newsletter' })).toBeNull()
    expect(redirect({ category: 'nope', utm_source: 'x' })).toEqual({ utm_source: 'x' })
  })

  it('redirects invalid and non-normalized values', () => {
    expect(redirect({ category: 'battery', page: '1' })).toEqual({ category: 'battery' })
    expect(redirect({ manufacturer: 'EcoCharge,Quantum Energy' })).toEqual({ manufacturer: ['ecocharge', 'quantum-energy'] })
    expect(redirect({ priceMin: '500', priceMax: '100' })).toEqual({ priceMin: '100', priceMax: '500' })
    expect(redirect({ q: '' })).toEqual({})
  })

  it('redirects a page beyond the last one to the clamped page', () => {
    expect(redirect({ category: 'battery', page: '7' }, { ...parseProductQuery({ category: 'battery' }), page: 3 }))
      .toEqual({ category: 'battery', page: '3' })
  })
})
