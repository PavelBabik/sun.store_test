import type { SpecUnit } from '../utils/categories'
import type { ProductQuery } from '../utils/product-query'
import type { Product } from './product'

export interface FacetOption {
  value: string
  label: string
  /** Number of products matching all other active filters plus this option. */
  count: number
}

export interface NumericRange {
  min: number
  max: number
}

export interface ProductsResponse {
  items: Product[]
  total: number
  page: number
  pageSize: number
  pageCount: number
  /** The query actually applied after validation (invalid params dropped, page clamped). */
  query: ProductQuery
  facets: {
    categories: FacetOption[]
    manufacturers: FacetOption[]
    /** Price span of products matching all filters except price. */
    price: NumericRange | null
    /** Spec span for the selected category; `null` when it has no spec unit or no category is selected. */
    spec: (NumericRange & { unit: SpecUnit }) | null
  }
}
