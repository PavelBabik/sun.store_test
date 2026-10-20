import { describe, expect, it } from 'vitest'
import { DEFAULT_SORT, MAX_SEARCH_LENGTH, parseProductQuery } from '../../shared/utils/product-query'

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

  it('drops spec bounds without a category that has a spec unit', () => {
    expect(parseProductQuery({ specMin: '5' })).toMatchObject({ specMin: null, specMax: null })
    expect(parseProductQuery({ category: 'connector', specMin: '5' })).toMatchObject({ specMin: null })
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
