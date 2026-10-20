<script setup lang="ts">
import type { NumericRange } from '#shared/types/api'

const props = defineProps<{
  label: string
  /** Current filter values from the URL. */
  min: number | null
  max: number | null
  /** Available span, shown as placeholders. */
  bounds: NumericRange | null
  unit?: string
  step?: number
}>()

const emit = defineEmits<{ update: [min: number | null, max: number | null] }>()

const id = useId()
const minInput = ref(toInput(props.min))
const maxInput = ref(toInput(props.max))

watch(() => [props.min, props.max], () => {
  minInput.value = toInput(props.min)
  maxInput.value = toInput(props.max)
})

// `UInput type="number"` emits numbers at runtime (its types say string), so values are
// coerced with `String()` on update to keep the local state a plain string.
function toInput(value: number | null): string {
  return value === null ? '' : String(value)
}

function toValue(input: string): number | null {
  if (input.trim() === '') return null
  const value = Number(input)
  return Number.isFinite(value) && value >= 0 ? value : null
}

// Committed on `change` (blur / Enter), not on every keystroke, to avoid a request per digit.
function commit() {
  const min = toValue(minInput.value)
  const max = toValue(maxInput.value)
  if (min !== props.min || max !== props.max) emit('update', min, max)
}
</script>

<template>
  <fieldset class="space-y-2">
    <legend class="text-sm font-medium">
      {{ label }}<span
        v-if="unit"
        class="text-muted"
      > ({{ unit }})</span>
    </legend>
    <div class="flex items-center gap-2">
      <UInput
        :id="`${id}-min`"
        :model-value="minInput"
        type="number"
        inputmode="decimal"
        min="0"
        :step="step ?? 'any'"
        :placeholder="bounds ? `Min ${bounds.min}` : 'Min'"
        :aria-label="`${label} from`"
        class="flex-1"
        @update:model-value="(value) => (minInput = String(value ?? ''))"
        @change="commit"
      />
      <span
        class="text-muted"
        aria-hidden="true"
      >–</span>
      <UInput
        :id="`${id}-max`"
        :model-value="maxInput"
        type="number"
        inputmode="decimal"
        min="0"
        :step="step ?? 'any'"
        :placeholder="bounds ? `Max ${bounds.max}` : 'Max'"
        :aria-label="`${label} to`"
        class="flex-1"
        @update:model-value="(value) => (maxInput = String(value ?? ''))"
        @change="commit"
      />
    </div>
  </fieldset>
</template>
