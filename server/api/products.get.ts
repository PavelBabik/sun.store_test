import { parseProductQuery } from '#shared/utils/product-query'
import type { ProductsResponse } from '#shared/types/api'

export default defineEventHandler(async (event): Promise<ProductsResponse> => {
  const query = parseProductQuery(getQuery(event))
  const products = await getProducts()

  // The data only changes on deploy, so responses can be cached by the CDN.
  setResponseHeader(event, 'Cache-Control', 'public, max-age=60, s-maxage=3600, stale-while-revalidate=86400')

  return filterProducts(products, query)
})
