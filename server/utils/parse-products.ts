import { parse } from 'csv-parse/sync'
import { CATEGORIES, getSpecUnit } from '#shared/utils/categories'
import { slugify } from '#shared/utils/slugify'
import type { CategorySlug } from '#shared/utils/categories'
import type { Product } from '#shared/types/product'
import { extractSpec } from './extract-spec'

interface CsvRow {
  name?: string
  manufacturer?: string
  price?: string
  description?: string
  category?: string
}

const categoryByCsvValue = new Map<string, CategorySlug>(
  CATEGORIES.map(category => [category.csvValue, category.slug]),
)

/**
 * Parses the raw CSV into normalized products.
 * Invalid rows (missing fields, bad price, unknown category) are skipped
 * and reported in `skipped`, so one broken line does not take the listing down.
 */
export function parseProducts(csv: string): { products: Product[], skipped: string[] } {
  const rows = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  }) as CsvRow[]

  const products: Product[] = []
  const skipped: string[] = []
  const usedIds = new Set<string>()

  rows.forEach((row, index) => {
    const line = index + 2 // +1 for the header, +1 for 1-based numbering
    const name = row.name ?? ''
    const manufacturer = row.manufacturer ?? ''
    const description = row.description ?? ''
    const price = Number(row.price)
    const category = categoryByCsvValue.get((row.category ?? '').toLowerCase())

    if (!name || !manufacturer) {
      skipped.push(`line ${line}: missing name or manufacturer`)
      return
    }
    if (!row.price || !Number.isFinite(price) || price < 0) {
      skipped.push(`line ${line}: invalid price "${row.price ?? ''}"`)
      return
    }
    if (!category) {
      skipped.push(`line ${line}: unknown category "${row.category ?? ''}"`)
      return
    }

    const baseId = slugify(name)
    let id = baseId
    for (let n = 2; usedIds.has(id); n++) id = `${baseId}-${n}`
    usedIds.add(id)

    const spec = extractSpec(name, description, getSpecUnit(category))

    products.push({ id, name, manufacturer, manufacturerSlug: slugify(manufacturer), price, description, category, spec })
  })

  return { products, skipped }
}
