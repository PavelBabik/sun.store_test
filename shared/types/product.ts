import type { CategorySlug, SpecUnit } from '../utils/categories'

export interface ProductSpec {
  /** Capacity in kWh (batteries) or power in W (solar panels). */
  value: number
  unit: SpecUnit
  /**
   * Where the value came from:
   * - `name+description` – number at the end of the name confirmed by the description (most reliable),
   * - `description` – first value with a unit found in the description,
   * - `name` – only the trailing number of the name (fallback, no unit in text).
   */
  source: 'name+description' | 'description' | 'name'
}

export interface Product {
  /** URL-safe identifier derived from the product name. */
  id: string
  name: string
  manufacturer: string
  /** URL-safe manufacturer identifier used in filters, e.g. "quantum-energy". */
  manufacturerSlug: string
  /** Price in EUR. */
  price: number
  description: string
  category: CategorySlug
  /** `null` for categories without a capacity/power (connectors) or when nothing could be extracted. */
  spec: ProductSpec | null
}
