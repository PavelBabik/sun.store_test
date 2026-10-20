<script setup lang="ts">
import { CATEGORIES } from '#shared/utils/categories'
import type { Product } from '#shared/types/product'

const props = defineProps<{ product: Product }>()

const categoryLabel = computed(() => CATEGORIES.find(c => c.slug === props.product.category)?.label)
</script>

<template>
  <UCard
    as="article"
    class="h-full"
    :ui="{ root: 'flex flex-col', body: 'flex flex-1 flex-col gap-3' }"
  >
    <div class="flex flex-wrap items-center gap-2">
      <UBadge
        :label="categoryLabel"
        color="neutral"
        variant="subtle"
        size="sm"
      />
      <UBadge
        v-if="product.spec"
        :label="formatSpec(product.spec)"
        color="primary"
        variant="soft"
        size="sm"
      />
    </div>

    <div>
      <h2 class="text-base font-semibold leading-snug">
        {{ product.name }}
      </h2>
      <p class="text-sm text-muted">
        {{ product.manufacturer }}
      </p>
    </div>

    <p class="text-sm text-toned line-clamp-3">
      {{ product.description }}
    </p>

    <p class="mt-auto text-lg font-bold">
      {{ formatPrice(product.price) }}
    </p>
  </UCard>
</template>
