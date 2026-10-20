import { CATEGORIES, getSpecUnit } from '#shared/utils/categories'
import { PAGE_SIZE } from '#shared/utils/product-query'
import type { ProductQuery } from '#shared/utils/product-query'
import type { FacetOption, NumericRange, ProductsResponse } from '#shared/types/api'
import type { Product } from '#shared/types/product'

type Filter = 'q' | 'category' | 'manufacturers' | 'price' | 'spec'

function normalizeText(value: string): string {
  return value.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function searchTokens(q: string): string[] {
  return normalizeText(q).split(' ').filter(Boolean)
}

/**
 * Relevance score for the search tokens, or 0 when the product does not match.
 * Every token must occur in the name, manufacturer or description (AND semantics);
 * a hit in the name weighs more than in the manufacturer, which weighs more than in the description.
 */
export function searchScore(product: Product, tokens: string[]): number {
  if (tokens.length === 0) return 1

  const name = normalizeText(product.name)
  const manufacturer = normalizeText(product.manufacturer)
  const description = normalizeText(product.description)

  let score = 0
  for (const token of tokens) {
    const tokenScore = (name.includes(token) ? 3 : 0)
      + (manufacturer.includes(token) ? 2 : 0)
      + (description.includes(token) ? 1 : 0)
    if (tokenScore === 0) return 0
    score += tokenScore
  }
  return score
}

function inRange(value: number, min: number | null, max: number | null): boolean {
  return (min === null || value >= min) && (max === null || value <= max)
}

/** `parseProductQuery` already drops spec bounds when the category has no spec unit. */
function hasSpecFilter(query: ProductQuery): boolean {
  return query.specMin !== null || query.specMax !== null
}

function matches(product: Product, query: ProductQuery, skip?: Filter): boolean {
  if (skip !== 'category' && query.category && product.category !== query.category) return false
  if (skip !== 'manufacturers' && query.manufacturers.length > 0 && !query.manufacturers.includes(product.manufacturerSlug)) return false
  if (skip !== 'price' && !inRange(product.price, query.priceMin, query.priceMax)) return false
  if (skip !== 'spec' && hasSpecFilter(query)) {
    if (!product.spec || !inRange(product.spec.value, query.specMin, query.specMax)) return false
  }
  return true
}

function span(values: number[]): NumericRange | null {
  if (values.length === 0) return null
  return { min: Math.min(...values), max: Math.max(...values) }
}

function compareNullableSpec(a: Product, b: Product, direction: 1 | -1): number {
  // Products without a spec always go last, regardless of the direction.
  if (!a.spec || !b.spec) return (a.spec ? 0 : 1) - (b.spec ? 0 : 1)
  return (a.spec.value - b.spec.value) * direction
}

function sortProducts(items: { product: Product, score: number }[], query: ProductQuery): Product[] {
  const sorted = [...items]
  const byName = (a: Product, b: Product) => a.name.localeCompare(b.name, 'en')

  sorted.sort((a, b) => {
    switch (query.sort) {
      case 'price-asc': return a.product.price - b.product.price || byName(a.product, b.product)
      case 'price-desc': return b.product.price - a.product.price || byName(a.product, b.product)
      case 'spec-asc': return compareNullableSpec(a.product, b.product, 1) || a.product.price - b.product.price
      case 'spec-desc': return compareNullableSpec(a.product, b.product, -1) || a.product.price - b.product.price
      case 'name-asc': return byName(a.product, b.product)
      // Relevance: best search match first; without a search the CSV order is kept (stable sort).
      case 'relevance': return b.score - a.score
    }
  })
  return sorted.map(item => item.product)
}

/**
 * Applies search, filters, sorting and pagination, and computes facets.
 * Each facet is counted with all *other* filters applied, so the UI can show
 * how many results picking an option would give without dead ends.
 */
export function filterProducts(products: Product[], query: ProductQuery): ProductsResponse {
  const tokens = searchTokens(query.q)
  const searched = products
    .map(product => ({ product, score: searchScore(product, tokens) }))
    .filter(item => item.score > 0)

  const matching = searched.filter(item => matches(item.product, query))
  const total = matching.length
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const page = Math.min(query.page, pageCount)
  const items = sortProducts(matching, query).slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const without = (filter: Filter) => searched.map(item => item.product).filter(product => matches(product, query, filter))

  // A category count answers "how many results if I switch to it". Spec bounds are in the unit of the
  // current category (kWh vs W), so they are dropped for the other categories – the page resets them too.
  const categories: FacetOption[] = CATEGORIES.map((category) => {
    const switched: ProductQuery = category.slug === query.category
      ? query
      : { ...query, category: category.slug, specMin: null, specMax: null }
    return {
      value: category.slug,
      label: category.label,
      count: searched.filter(item => matches(item.product, switched)).length,
    }
  })

  const manufacturerCounts = new Map<string, FacetOption>()
  for (const product of without('manufacturers')) {
    const option = manufacturerCounts.get(product.manufacturerSlug)
      ?? { value: product.manufacturerSlug, label: product.manufacturer, count: 0 }
    option.count++
    manufacturerCounts.set(product.manufacturerSlug, option)
  }
  // Selected manufacturers stay visible even when other filters leave them with zero results.
  for (const slug of query.manufacturers) {
    if (!manufacturerCounts.has(slug)) {
      const known = products.find(product => product.manufacturerSlug === slug)
      if (known) manufacturerCounts.set(slug, { value: slug, label: known.manufacturer, count: 0 })
    }
  }
  const manufacturers = [...manufacturerCounts.values()].sort((a, b) => a.label.localeCompare(b.label, 'en'))

  const specUnit = query.category ? getSpecUnit(query.category) : null
  const specSpan = specUnit
    ? span(without('spec').flatMap(product => (product.spec ? [product.spec.value] : [])))
    : null

  return {
    items,
    total,
    page,
    pageSize: PAGE_SIZE,
    pageCount,
    query: { ...query, page },
    facets: {
      categories,
      manufacturers,
      price: span(without('price').map(product => product.price)),
      spec: specUnit && specSpan ? { ...specSpan, unit: specUnit } : null,
    },
  }
}
