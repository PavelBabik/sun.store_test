<script setup lang="ts">
const SEARCH_DEBOUNCE_MS = 300

const { query, update } = useProductFilters()

const input = ref(query.value.q)
let timer: ReturnType<typeof setTimeout> | undefined

function commit() {
  clearTimeout(timer)
  const q = input.value.trim()
  if (q === query.value.q) return
  // Starting or clearing a search adds a history entry; refining an existing one replaces it,
  // so "back" goes to the previous filter state instead of stepping through every keystroke.
  update({ q }, { replace: query.value.q !== '' && q !== '' })
}

watch(input, () => {
  clearTimeout(timer)
  timer = setTimeout(commit, SEARCH_DEBOUNCE_MS)
})

// Keep the field in sync when the URL changes from outside (back button, "clear filters").
watch(() => query.value.q, (q) => {
  if (q !== input.value.trim()) input.value = q
})

onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <form
    role="search"
    class="w-full"
    @submit.prevent="commit"
  >
    <UInput
      v-model="input"
      type="search"
      icon="i-lucide-search"
      placeholder="Search by name, manufacturer or description"
      aria-label="Search products"
      size="lg"
      class="w-full"
      :ui="{ trailing: 'pe-1' }"
    >
      <template
        v-if="input"
        #trailing
      >
        <UButton
          color="neutral"
          variant="link"
          size="sm"
          icon="i-lucide-x"
          aria-label="Clear search"
          @click="input = ''; commit()"
        />
      </template>
    </UInput>
  </form>
</template>
