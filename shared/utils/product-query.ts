import {getSpecUnit, isCategorySlug} from './categories'
import type {CategorySlug} from './categories'
import {slugify} from './slugify'

/** `spec-*` options are labelled with the category's spec name in the UI ("Capacity", "Power"). */
export const SORT_OPTIONS = [
    {value: 'relevance', label: 'Relevance', needsSpec: false},
    {value: 'price-asc', label: 'Price: low to high', needsSpec: false},
    {value: 'price-desc', label: 'Price: high to low', needsSpec: false},
    {value: 'spec-asc', label: 'low to high', needsSpec: true},
    {value: 'spec-desc', label: 'high to low', needsSpec: true},
    {value: 'name-asc', label: 'Name: A–Z', needsSpec: false},
] as const

export const CHEMISTRY_OPTIONS = [
    {value: 'lfp', label: 'LFP', terms: ['lfp', 'lifepo4']},
    {value: 'nmc', label: 'NMC', terms: ['nmc']},
] as const

export type Chemistry = (typeof CHEMISTRY_OPTIONS)[number]['value']

function isChemistry(value: unknown): value is Chemistry {
    return CHEMISTRY_OPTIONS.some(c => c.value === value)
}

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
    chemistries: Chemistry[]
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
    // kWh and W cannot be compared, so spec bounds and spec sorting need a category that has a spec unit.
    const hasSpec = validCategory !== null && getSpecUnit(validCategory) !== null
    const [specMin, specMax] = hasSpec
        ? orderRange(toNonNegativeNumber(raw.specMin), toNonNegativeNumber(raw.specMax))
        : [null, null]
    const validSort = isSortOption(sort) && (hasSpec || !SORT_OPTIONS.find(o => o.value === sort)?.needsSpec)
        ? sort
        : DEFAULT_SORT

    const manufacturers = [...new Set(toStringList(raw.manufacturer).map(slugify).filter(Boolean))].sort()
    const chemistries = [...new Set(toStringList(raw.chemistry).filter(isChemistry))].sort()
    return {
        q,
        category: validCategory,
        manufacturers,
        chemistries,
        priceMin,
        priceMax,
        specMin,
        specMax,
        sort: validSort,
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
    if (query.chemistries.length > 0) result.chemistry = [...query.chemistries]
    setNumber('priceMin', query.priceMin)
    setNumber('priceMax', query.priceMax)
    setNumber('specMin', query.specMin)
    setNumber('specMax', query.specMax)
    if (query.sort !== DEFAULT_SORT) result.sort = query.sort
    if (query.page > 1) result.page = String(query.page)

    return result
}

const QUERY_KEYS = new Set(['q', 'category', 'manufacturer', 'chemistry', 'priceMin', 'priceMax', 'specMin', 'specMax', 'sort', 'page'])

function toStrings(value: unknown): string[] {
    return (Array.isArray(value) ? value : [value]).map(item => (item === null || item === undefined ? '' : String(item)))
}

/**
 * Returns the canonical query to redirect to when the URL is not canonical
 * (invalid values, out-of-range page, `manufacturer=a,b` instead of repeated keys…), or `null` if it already is.
 * Only listing params are compared; anything else (e.g. `utm_*`) is kept as is, and key order does not matter.
 */
export function canonicalRedirect(raw: Record<string, unknown>, applied: ProductQuery): RouteQuery | null {
    const canonical = toRouteQuery(applied)
    const current = Object.keys(raw).filter(key => QUERY_KEYS.has(key))

    const isCanonical = current.length === Object.keys(canonical).length
        && current.every((key) => {
            const expected = canonical[key]
            return expected !== undefined && toStrings(raw[key]).join('\n') === toStrings(expected).join('\n')
        })
    if (isCanonical) return null

    const extra: RouteQuery = {}
    for (const [key, value] of Object.entries(raw)) {
        if (!QUERY_KEYS.has(key)) extra[key] = Array.isArray(value) ? toStrings(value) : toStrings(value)[0] ?? ''
    }
    return {...extra, ...canonical}
}
