<script setup lang="ts">
/**
 * Minerva search header: back arrow, search input, clear button. Shows an
 * inline progress bar while a semantic search is running.
 */
import { computed, ref, watch } from 'vue'
import { CdxButton, CdxIcon, CdxProgressBar } from '@wikimedia/codex'
import { cdxIconArrowPrevious, cdxIconClear, cdxIconSearch } from '@wikimedia/codex-icons'

interface Props {
  modelValue: string
  placeholder?: string
  loading?: boolean
  /** Focus the field as soon as the header mounts (opening the overlay). */
  autofocus?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: 'Ask Wikipedia anything…',
  loading: false,
  autofocus: true,
})

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void
  (event: 'submit', value: string): void
  (event: 'back'): void
}>()

const input = ref<HTMLInputElement | null>(null)

const value = computed({
  get: () => props.modelValue,
  set: (next: string) => emit('update:modelValue', next),
})

watch(
  input,
  (element) => {
    if (element && props.autofocus) element.focus()
  },
  { immediate: true },
)

function onClear(): void {
  emit('update:modelValue', '')
  input.value?.focus()
}

function onSubmit(event: Event): void {
  event.preventDefault()
  emit('submit', props.modelValue)
}
</script>

<template>
  <div class="mss-header">
    <form class="mss-header__row" role="search" @submit="onSubmit">
      <CdxButton
        class="mss-header__back"
        weight="quiet"
        aria-label="Back"
        type="button"
        @click="emit('back')"
      >
        <CdxIcon :icon="cdxIconArrowPrevious" />
      </CdxButton>

      <div class="mss-header__field">
        <CdxIcon class="mss-header__field-icon" :icon="cdxIconSearch" size="small" />
        <input
          ref="input"
          v-model="value"
          class="mss-header__input"
          type="search"
          enterkeyhint="search"
          autocomplete="off"
          :placeholder="props.placeholder"
          aria-label="Search Wikipedia"
        />
      </div>

      <CdxButton
        class="mss-header__clear"
        weight="quiet"
        aria-label="Clear search"
        type="button"
        @click="onClear"
      >
        <CdxIcon :icon="cdxIconClear" />
      </CdxButton>
    </form>

    <CdxProgressBar v-if="props.loading" class="mss-header__progress" inline />
  </div>
</template>

<style scoped>
.mss-header {
  position: relative;
  flex-shrink: 0;
  background-color: var(--background-color-base, #fff);
}

.mss-header__row {
  display: flex;
  align-items: center;
  gap: var(--spacing-25, 4px);
  padding: var(--spacing-25, 4px) var(--spacing-50, 8px) var(--spacing-25, 4px)
    var(--spacing-12, 2px);
}

.mss-header__back,
.mss-header__clear {
  flex-shrink: 0;
  width: var(--size-icon-large, 40px);
  min-width: var(--size-icon-large, 40px);
  height: var(--size-icon-large, 40px);
  min-height: var(--size-icon-large, 40px);
  padding: 0;
  color: var(--color-subtle, #54595d);
}

.mss-header__field {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  gap: var(--spacing-50, 8px);
  box-sizing: border-box;
  min-width: 0;
  height: 36px;
  padding-inline: var(--spacing-50, 8px);
  border: var(--border-width-base, 1px) solid var(--border-color-base, #a2a9b1);
  border-radius: var(--border-radius-base, 2px);
  background-color: var(--background-color-base, #fff);
}

.mss-header__field:focus-within {
  border-color: var(--border-color-progressive--focus, #36c);
  box-shadow: inset 0 0 0 1px var(--border-color-progressive--focus, #36c);
}

.mss-header__field-icon {
  flex-shrink: 0;
  color: var(--color-subtle, #54595d);
}

.mss-header__input {
  flex: 1 1 auto;
  min-width: 0;
  border: 0;
  background: none;
  color: var(--color-base, #202122);
  font-family: inherit;
  font-size: var(--font-size-medium, 1rem);
  line-height: var(--line-height-small, 1.375);
}

.mss-header__input:focus {
  outline: none;
}

.mss-header__input::placeholder {
  color: var(--color-placeholder, #72777d);
}

/* Hide the WebKit search decorations — the header has its own clear button. */
.mss-header__input::-webkit-search-cancel-button,
.mss-header__input::-webkit-search-decoration {
  appearance: none;
}

.mss-header__progress {
  position: absolute;
  inset-block-end: 2px;
  /* Sits under the input, clear of the back and clear buttons. */
  inset-inline: 44px;
}
</style>
