<script setup lang="ts">
const props = defineProps<{
  page: number
  pageCount: number
  pageSize: number
  total: number
}>()

const { locationFor } = useProductFilters()

const range = computed(() => {
  const from = (props.page - 1) * props.pageSize + 1
  return { from, to: Math.min(props.page * props.pageSize, props.total) }
})
</script>

<template>
  <nav
    v-if="pageCount > 1"
    aria-label="Pagination"
    class="flex flex-col items-center gap-3 sm:flex-row sm:justify-between"
  >
    <p class="text-sm text-muted">
      Showing {{ range.from }}–{{ range.to }} of {{ total }}
    </p>
    <!-- `to` renders every page as a real link: crawlable, works without JS, opens in a new tab. -->
    <UPagination
      :page="page"
      :total="total"
      :items-per-page="pageSize"
      :to="(target: number) => locationFor({ page: target })"
      show-edges
      :sibling-count="1"
    />
  </nav>
</template>
