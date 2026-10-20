import type { CategorySlug } from '../utils/categories'

export interface Product {
  /** URL-safe identifier derived from the product name. */
  id: string
  name: string
  manufacturer: string
  /** Price in EUR. */
  price: number
  description: string
  category: CategorySlug
}
