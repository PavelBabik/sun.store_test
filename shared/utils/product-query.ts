import { getSpecUnit, isCategorySlug } from './categories'
import type { CategorySlug } from './categories'
import { slugify } from './slugify'

export const SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'spec-asc', label: 'Capacity / power: low to high' },
  { value: 'spec-desc', label: 'Capacity / power: high to low' },
  { value: 'name-asc', label: 'Name: A–Z' },
] as const

export type SortOption = (typeof SORT_OPTIONS)[number]['value']

export const DEFAULT_SORT: SortOption = 'relevance'
export const PAGE_SIZE = 24
export const MAX_SEARCH_LENGTH = 100

/** Normalized listing query. Shared by the API and the page, so both read the URL the same way. */
export interface ProductQuery {
  q: string
  category: CategorySlug | null
  /** Manufacturer slugs, sorted and unique. */
  manufacturers: string[]
  priceMin: number | null
  priceMax: number | null
  /** Capacity (kWh) or power (W) bounds; only meaningful together with a category that has a spec unit. */
  specMin: number | null
  specMax: number | null
  sort: SortOption
  page: number
}

type RawQuery = Record<string, unknown>

function first(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value
}

function toStringList(value: unknown): string[] {
  const list = Array.isArray(value) ? value : [value]
  // Both `?manufacturer=a&manufacturer=b` and `?manufacturer=a,b` are accepted.
  return list.flatMap(item => (typeof item === 'string' ? item.split(',') : []))
}

function toNonNegativeNumber(value: unknown): number | null {
  const raw = first(value)
  if (typeof raw !== 'string' && typeof raw !== 'number') return null
  if (typeof raw === 'string' && raw.trim() === '') return null
  const number = Number(raw)
  return Number.isFinite(number) && number >= 0 ? number : null
}

function orderRange(min: number | null, max: number | null): [number | null, number | null] {
  return min !== null && max !== null && min > max ? [max, min] : [min, max]
}

function isSortOption(value: unknown): value is SortOption {
  return SORT_OPTIONS.some(option => option.value === value)
}

/**
 * Turns an untrusted URL query into a valid `ProductQuery`.
 * It is lenient on purpose: unknown or malformed values are dropped instead of
 * failing the request, so a hand-edited or outdated link still renders a page.
 */
export function parseProductQuery(raw: RawQuery): ProductQuery {
  const q = String(first(raw.q) ?? '').trim().replace(/\s+/g, ' ').slice(0, MAX_SEARCH_LENGTH)
  const category = first(raw.category)
  const sort = first(raw.sort)
  const page = Math.floor(toNonNegativeNumber(raw.page) ?? 1)

  const [priceMin, priceMax] = orderRange(toNonNegativeNumber(raw.priceMin), toNonNegativeNumber(raw.priceMax))
  const validCategory = isCategorySlug(category) ? category : null
  // kWh and W cannot be compared, so spec bounds need a category that has a spec unit.
  const [specMin, specMax] = validCategory && getSpecUnit(validCategory)
    ? orderRange(toNonNegativeNumber(raw.specMin), toNonNegativeNumber(raw.specMax))
    : [null, null]

  const manufacturers = [...new Set(toStringList(raw.manufacturer).map(slugify).filter(Boolean))].sort()

  return {
    q,
    category: validCategory,
    manufacturers,
    priceMin,
    priceMax,
    specMin,
    specMax,
    sort: isSortOption(sort) ? sort : DEFAULT_SORT,
    page: page >= 1 ? page : 1,
  }
}

export type RouteQuery = Record<string, string | string[]>

/**
 * Inverse of `parseProductQuery`: builds the URL query, omitting defaults,
 * with a stable key order so equal filters always produce the same URL.
 */
export function toRouteQuery(query: ProductQuery): RouteQuery {
  const result: RouteQuery = {}
  const setNumber = (key: string, value: number | null) => {
    if (value !== null) result[key] = String(value)
  }

  if (query.q) result.q = query.q
  if (query.category) result.category = query.category
  if (query.manufacturers.length > 0) result.manufacturer = [...query.manufacturers]
  setNumber('priceMin', query.priceMin)
  setNumber('priceMax', query.priceMax)
  setNumber('specMin', query.specMin)
  setNumber('specMax', query.specMax)
  if (query.sort !== DEFAULT_SORT) result.sort = query.sort
  if (query.page > 1) result.page = String(query.page)

  return result
}
