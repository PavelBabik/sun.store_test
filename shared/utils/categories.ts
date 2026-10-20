export type SpecUnit = 'kWh' | 'W'

export const CATEGORIES = [
  { slug: 'battery', label: 'Batteries', csvValue: 'battery', specUnit: 'kWh', specLabel: 'Capacity' },
  { slug: 'connector', label: 'Connectors', csvValue: 'connector', specUnit: null, specLabel: null },
  { slug: 'solar-panel', label: 'Solar panels', csvValue: 'solar panel', specUnit: 'W', specLabel: 'Power' },
] as const satisfies readonly {
  slug: string
  label: string
  csvValue: string
  specUnit: SpecUnit | null
  specLabel: string | null
}[]

export type CategorySlug = (typeof CATEGORIES)[number]['slug']

export function isCategorySlug(value: unknown): value is CategorySlug {
  return CATEGORIES.some(category => category.slug === value)
}

export function getSpecUnit(category: CategorySlug): SpecUnit | null {
  return CATEGORIES.find(c => c.slug === category)?.specUnit ?? null
}
