import type { ProductsResponse } from '../types/api'
import { CATEGORIES } from './categories'
import { formatNumber, formatPrice } from './format'
import { DEFAULT_SORT, toRouteQuery } from './product-query'
import type { RouteQuery } from './product-query'

export const SITE_NAME = 'sun.store'

export interface ListingSeo {
  /** Visible page heading (h1), also the base of the title. */
  heading: string
  title: string
  description: string
  robots: 'index, follow' | 'noindex, follow'
  /** Query of the canonical URL, or `null` when the page is not meant to be indexed. */
  canonicalQuery: RouteQuery | null
}

function rangeText(min: number | null, max: number | null, format: (value: number) => string): string {
  if (min !== null && max !== null) return `${format(min)}–${format(max)}`
  if (min !== null) return `from ${format(min)}`
  return `up to ${format(max ?? 0)}`
}

function listText(items: string[], limit = 3): string {
  if (items.length <= limit) return items.join(', ')
  return `${items.slice(0, limit).join(', ')} and ${items.length - limit} more`
}

/**
 * Indexing policy: only "landing page" combinations are indexable – the full listing, a category,
 * and a category with a single manufacturer (plus their pages). Search results, multi-select,
 * numeric ranges and empty results get `noindex, follow`: they are useful for users but would create
 * an unbounded number of thin, near-duplicate URLs. Sorting does not change the set of products,
 * so a sorted URL canonicalizes to the unsorted one.
 */
export function buildListingSeo(response: ProductsResponse): ListingSeo {
  const { query, total, facets } = response
  const category = CATEGORIES.find(c => c.slug === query.category)
  const manufacturerLabels = query.manufacturers.map(slug => facets.manufacturers.find(m => m.value === slug)?.label ?? slug)
  const specUnit = facets.spec?.unit ?? category?.specUnit ?? null

  // Heading, e.g. "EcoCharge Batteries 10–15 kWh" or "“mc4” in Connectors".
  const subject = category?.label ?? 'Solar products'
  let heading = manufacturerLabels.length === 1 ? `${manufacturerLabels[0]} ${subject}` : subject
  if (query.specMin !== null || query.specMax !== null) {
    // "10–15 kWh" rather than "10 kWh–15 kWh".
    if (specUnit) heading += ` ${rangeText(query.specMin, query.specMax, formatNumber)} ${specUnit}`
  }
  if (query.priceMin !== null || query.priceMax !== null) {
    heading += `, ${rangeText(query.priceMin, query.priceMax, formatPrice)}`
  }
  if (query.q) heading = `“${query.q}” in ${heading}`

  const pageSuffix = response.page > 1 ? ` – Page ${response.page}` : ''
  const title = `${heading}${pageSuffix} | ${SITE_NAME}`

  // Description built from real numbers of the current result set.
  let description: string
  if (total === 0) {
    description = `No products match these filters on ${SITE_NAME}. Try removing some filters.`
  }
  else {
    const noun = (category?.label ?? 'solar products').toLowerCase()
    const manufacturers = manufacturerLabels.length > 0
      ? manufacturerLabels
      : facets.manufacturers.filter(m => m.count > 0).map(m => m.label)
    const priceMin = Math.max(facets.price?.min ?? 0, query.priceMin ?? 0)
    const priceMax = Math.min(facets.price?.max ?? Infinity, query.priceMax ?? Infinity)
    const prices = Number.isFinite(priceMax) ? `, priced ${formatPrice(priceMin)}–${formatPrice(priceMax)}` : ''
    description = `Compare ${total} ${total === 1 ? 'product' : noun} from ${listText(manufacturers)}${prices}. `
      + 'B2B marketplace for PV installers and distributors across Europe.'
  }

  const indexable = total > 0
    && !query.q
    && query.manufacturers.length <= 1
    && query.priceMin === null && query.priceMax === null
    && query.specMin === null && query.specMax === null

  return {
    heading,
    title,
    description,
    robots: indexable ? 'index, follow' : 'noindex, follow',
    canonicalQuery: indexable ? toRouteQuery({ ...query, sort: DEFAULT_SORT, page: response.page }) : null,
  }
}
