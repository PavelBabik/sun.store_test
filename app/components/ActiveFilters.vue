<script setup lang="ts">
import { CATEGORIES } from '#shared/utils/categories'
import type { ProductQuery } from '#shared/utils/product-query'
import type { ProductsResponse } from '#shared/types/api'

const props = defineProps<{ facets: ProductsResponse['facets'] }>()

const { query, update, reset, hasActiveFilters } = useProductFilters()

interface Chip {
  key: string
  label: string
  remove: Partial<ProductQuery>
}

function rangeLabel(min: number | null, max: number | null, format: (value: number) => string): string {
  if (min !== null && max !== null) return `${format(min)} – ${format(max)}`
  return min !== null ? `from ${format(min)}` : `up to ${format(max ?? 0)}`
}

const chips = computed<Chip[]>(() => {
  const q = query.value
  const list: Chip[] = []

  if (q.q) list.push({ key: 'q', label: `“${q.q}”`, remove: { q: '' } })
  if (q.category) {
    const label = CATEGORIES.find(c => c.slug === q.category)?.label ?? q.category
    list.push({ key: 'category', label, remove: { category: null } })
  }
  for (const slug of q.manufacturers) {
    const label = props.facets.manufacturers.find(m => m.value === slug)?.label ?? slug
    list.push({ key: `m-${slug}`, label, remove: { manufacturers: q.manufacturers.filter(m => m !== slug) } })
  }
  if (q.priceMin !== null || q.priceMax !== null) {
    list.push({ key: 'price', label: rangeLabel(q.priceMin, q.priceMax, formatPrice), remove: { priceMin: null, priceMax: null } })
  }
  const unit = props.facets.spec?.unit
  if (unit && (q.specMin !== null || q.specMax !== null)) {
    const format = (value: number) => formatSpec({ value, unit })
    list.push({ key: 'spec', label: rangeLabel(q.specMin, q.specMax, format), remove: { specMin: null, specMax: null } })
  }
  return list
})
</script>

<template>
  <div
    v-if="hasActiveFilters"
    class="flex flex-wrap items-center gap-2"
  >
    <UButton
      v-for="chip in chips"
      :key="chip.key"
      :label="chip.label"
      :aria-label="`Remove filter ${chip.label}`"
      trailing-icon="i-lucide-x"
      size="sm"
      color="neutral"
      variant="subtle"
      @click="update(chip.remove)"
    />
    <UButton
      label="Clear all"
      size="sm"
      color="neutral"
      variant="link"
      @click="reset()"
    />
  </div>
</template>
