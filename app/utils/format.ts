import type { ProductSpec } from '#shared/types/product'

const priceFormatter = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' })
const numberFormatter = new Intl.NumberFormat('en-IE', { maximumFractionDigits: 2 })

export function formatPrice(price: number): string {
  return priceFormatter.format(price)
}

export function formatSpec(spec: Pick<ProductSpec, 'value' | 'unit'>): string {
  return `${numberFormatter.format(spec.value)} ${spec.unit}`
}
