export const CATEGORIES = [
  { slug: 'battery', label: 'Batteries', csvValue: 'battery' },
  { slug: 'connector', label: 'Connectors', csvValue: 'connector' },
  { slug: 'solar-panel', label: 'Solar panels', csvValue: 'solar panel' },
] as const

export type CategorySlug = (typeof CATEGORIES)[number]['slug']

export function isCategorySlug(value: unknown): value is CategorySlug {
  return CATEGORIES.some(category => category.slug === value)
}
