<template>
  <div class="min-h-screen flex flex-col">
    <header class="border-b border-default">
      <UContainer class="h-16 flex items-center justify-between">
        <NuxtLink
          to="/"
          class="text-lg font-semibold"
        >
          sun<span class="text-primary">.store</span>
        </NuxtLink>
        <UColorModeButton />
      </UContainer>
    </header>

    <main class="flex-1">
      <UContainer class="py-6">
        <slot />
      </UContainer>
    </main>

    <footer class="border-t border-default">
      <UContainer class="py-4 text-sm text-muted">
        Recruitment task – product listing
      </UContainer>
    </footer>
  </div>
</template>
