import type { RouteLocationRaw } from 'vue-router'
import { parseProductQuery, toRouteQuery } from '#shared/utils/product-query'
import type { ProductQuery } from '#shared/utils/product-query'

interface UpdateOptions {
  /** Replace the current history entry instead of adding a new one (e.g. while typing a search). */
  replace?: boolean
}

/**
 * Filters live in the URL only. Reading parses `route.query`, writing navigates,
 * so SSR, shared links, reload and the back/forward buttons all see the same state.
 */
export function useProductFilters() {
  const route = useRoute()

  const query = computed(() => parseProductQuery(route.query))

  /** Applies a change on top of the current query; any filter change returns to page 1 (unless `page` is the change). */
  function nextQuery(patch: Partial<ProductQuery>): ProductQuery {
    const next: ProductQuery = { ...query.value, page: 1, ...patch }
    // Capacity (kWh) and power (W) bounds are meaningless in another category.
    if (patch.category !== undefined && patch.category !== query.value.category) {
      next.specMin = null
      next.specMax = null
    }
    // Round-trip through the parser so the URL is always canonical (ranges ordered, invalid values dropped).
    return parseProductQuery(toRouteQuery(next))
  }

  /** Route location for a change – used for real links (crawlable, open in a new tab). */
  function locationFor(patch: Partial<ProductQuery>): RouteLocationRaw {
    return { path: route.path, query: toRouteQuery(nextQuery(patch)) }
  }

  function update(patch: Partial<ProductQuery>, options: UpdateOptions = {}) {
    return navigateTo(locationFor(patch), { replace: options.replace })
  }

  /** Clears all filters and the search but keeps the chosen sort order. */
  function reset() {
    return navigateTo({ path: route.path, query: toRouteQuery({ ...parseProductQuery({}), sort: query.value.sort }) })
  }

  const hasActiveFilters = computed(() => {
    const { q, category, manufacturers, priceMin, priceMax, specMin, specMax } = query.value
    return Boolean(q || category || manufacturers.length > 0)
      || [priceMin, priceMax, specMin, specMax].some(value => value !== null)
  })

  return { query, update, reset, locationFor, hasActiveFilters }
}
