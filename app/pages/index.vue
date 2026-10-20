<script setup lang="ts">
const route = useRoute()

// The URL is the single source of truth for filters: `useFetch` runs on the server
// for the first render (SSR) and refetches on the client whenever the query changes.
const { data, status, error } = await useFetch('/api/products', {
  query: computed(() => route.query),
})

const isLoading = computed(() => status.value === 'pending')
</script>

<template>
  <div class="space-y-6">
    <header class="flex flex-wrap items-end justify-between gap-2">
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
    </header>

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
        :actions="[{ label: 'Clear all filters', to: '/', color: 'neutral', variant: 'subtle' }]"
      />

      <ul
        v-else
        class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 transition-opacity"
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
  </div>
</template>
