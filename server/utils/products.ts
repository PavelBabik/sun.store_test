import type { Product } from '#shared/types/product'
import { parseProducts } from './parse-products'
import { readProductsCsv } from './products-source'

// The CSV is static, so it is parsed once per server instance and reused.
let productsPromise: Promise<Product[]> | undefined

export function getProducts(): Promise<Product[]> {
  productsPromise ??= readProductsCsv().then((csv) => {
    const { products, skipped } = parseProducts(csv)
    if (skipped.length > 0) {
      console.warn(`[products] skipped ${skipped.length} invalid row(s):\n${skipped.join('\n')}`)
    }
    return products
  }).catch((error: unknown) => {
    // Do not cache a failure: the next request retries.
    productsPromise = undefined
    throw error
  })

  return productsPromise
}
