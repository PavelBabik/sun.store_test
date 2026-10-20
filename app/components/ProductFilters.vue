<script setup lang="ts">
import type { ProductsResponse } from '#shared/types/api'

defineProps<{ facets: ProductsResponse['facets'] }>()

const { query, update, locationFor } = useProductFilters()
</script>

<template>
  <div class="space-y-6">
    <nav aria-labelledby="category-heading">
      <h2
        id="category-heading"
        class="mb-2 text-sm font-medium"
      >
        Category
      </h2>
      <!-- Real links rather than buttons: crawlable and can be opened in a new tab. -->
      <ul class="space-y-1">
        <li>
          <UButton
            :to="locationFor({ category: null })"
            :variant="query.category === null ? 'soft' : 'ghost'"
            :color="query.category === null ? 'primary' : 'neutral'"
            :aria-current="query.category === null ? 'page' : undefined"
            label="All products"
            block
            class="justify-start"
          />
        </li>
        <li
          v-for="category in facets.categories"
          :key="category.value"
        >
          <UButton
            :to="locationFor({ category: category.value as typeof query.category })"
            :variant="query.category === category.value ? 'soft' : 'ghost'"
            :color="query.category === category.value ? 'primary' : 'neutral'"
            :aria-current="query.category === category.value ? 'page' : undefined"
            block
            class="justify-between"
          >
            {{ category.label }}
            <span class="text-xs text-muted">{{ category.count }}</span>
          </UButton>
        </li>
      </ul>
    </nav>

    <RangeFilter
      label="Price"
      unit="EUR"
      :min="query.priceMin"
      :max="query.priceMax"
      :bounds="facets.price"
      @update="(priceMin, priceMax) => update({ priceMin, priceMax })"
    />

    <fieldset v-if="facets.manufacturers.length > 0">
      <legend class="mb-2 text-sm font-medium">
        Manufacturer
      </legend>
      <div class="max-h-72 overflow-y-auto pe-1">
        <UCheckboxGroup
          :model-value="query.manufacturers"
          :items="facets.manufacturers.map(m => ({
            value: m.value,
            label: `${m.label} (${m.count})`,
            disabled: m.count === 0 && !query.manufacturers.includes(m.value),
          }))"
          @update:model-value="(manufacturers) => update({ manufacturers: manufacturers as string[] })"
        />
      </div>
    </fieldset>
  </div>
</template>
