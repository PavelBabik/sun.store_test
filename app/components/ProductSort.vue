<script setup lang="ts">
import { CATEGORIES } from '#shared/utils/categories'
import { SORT_OPTIONS } from '#shared/utils/product-query'
import type { SortOption } from '#shared/utils/product-query'

const { query, update } = useProductFilters()

// Spec sorting only exists inside a category with a spec unit, labelled "Capacity" or "Power".
const items = computed(() => {
  const category = CATEGORIES.find(c => c.slug === query.value.category)
  return SORT_OPTIONS
    .filter(option => !option.needsSpec || category?.specLabel)
    .map(option => ({
      value: option.value,
      label: option.needsSpec ? `${category?.specLabel}: ${option.label}` : option.label,
    }))
})
</script>

<template>
  <USelect
    :model-value="query.sort"
    :items="items"
    aria-label="Sort products"
    icon="i-lucide-arrow-down-up"
    class="w-60"
    @update:model-value="(sort) => update({ sort: sort as SortOption })"
  />
</template>
