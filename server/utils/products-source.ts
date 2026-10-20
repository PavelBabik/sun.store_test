// `server/assets` is registered by Nitro as the `assets:server` storage and is
// bundled into the build output, so the CSV is available on serverless
// platforms too (no reliance on the filesystem layout at runtime).
export async function readProductsCsv(): Promise<string> {
  const csv = await useStorage('assets:server').getItem<string>('products.csv')

  if (typeof csv !== 'string' || csv.length === 0) {
    throw createError({ statusCode: 500, statusMessage: 'products.csv is missing or empty' })
  }

  return csv
}
