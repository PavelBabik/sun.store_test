<script setup lang="ts">
const route = useRoute()
const { reset } = useProductFilters()

// The URL is the single source of truth for filters: `useFetch` runs on the server
// for the first render (SSR) and refetches on the client whenever the query changes.
const { data, status, error } = await useFetch('/api/products', {
  query: computed(() => route.query),
})

const isLoading = computed(() => status.value === 'pending')
const filtersOpen = ref(false)

// Close the mobile drawer after a filter is applied.
watch(() => route.fullPath, () => {
  filtersOpen.value = false
})
</script>

<template>
  <div class="lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-8">
    <aside
      class="hidden lg:block"
      aria-label="Filters"
    >
      <ProductFilters
        v-if="data"
        :facets="data.facets"
      />
    </aside>

    <section class="space-y-4">
      <header class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 class="text-2xl font-bold">
            Solar products
          </h1>
          <p
            v-if="data"
            class="text-sm text-muted"
            aria-live="polite"
          >
            {{ data.total }} {{ data.total === 1 ? 'product' : 'products' }}
          </p>
        </div>
        <ProductSort />
      </header>

      <div class="flex gap-2">
        <ProductSearch class="flex-1" />
        <USlideover
          v-model:open="filtersOpen"
          title="Filters"
          side="left"
          class="lg:hidden"
        >
          <UButton
            label="Filters"
            icon="i-lucide-sliders-horizontal"
            color="neutral"
            variant="outline"
            size="lg"
            class="lg:hidden"
          />
          <template #body>
            <ProductFilters
              v-if="data"
              :facets="data.facets"
            />
          </template>
        </USlideover>
      </div>

      <ActiveFilters
        v-if="data"
        :facets="data.facets"
      />

      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        title="Could not load products"
        :description="error.statusMessage || error.message"
      />

      <template v-else-if="data">
        <UEmpty
          v-if="data.items.length === 0"
          icon="i-lucide-search-x"
          title="No products found"
          description="Try a different search or remove some filters."
          :actions="[{ label: 'Clear all filters', color: 'neutral', variant: 'subtle', onClick: () => reset() }]"
        />

        <ul
          v-else
          class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 transition-opacity"
          :class="{ 'opacity-60': isLoading }"
          :aria-busy="isLoading"
        >
          <li
            v-for="product in data.items"
            :key="product.id"
          >
            <ProductCard :product="product" />
          </li>
        </ul>
      </template>
    </section>
  </div>
</template>
