<script setup lang="ts">
/**
 * Semantic search entry point above the typeahead results — offers to answer
 * the typed query instead of matching article titles.
 */
import { CdxButton } from '@wikimedia/codex'

interface Props {
  query: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (event: 'find', query: string): void
}>()
</script>

<template>
  <div class="mss-entry">
    <button
      type="button"
      class="mss-entry__hit"
      :aria-label="`Find answers in Wikipedia for ${props.query}`"
      @click="emit('find', props.query)"
    >
      <span class="mss-entry__title">Find answers in Wikipedia</span>
      <span class="mss-entry__row">
        <span class="mss-entry__query">“{{ props.query }}”</span>
        <CdxButton
          class="mss-entry__button"
          action="progressive"
          weight="primary"
          tabindex="-1"
          type="button"
        >
          Find
        </CdxButton>
      </span>
    </button>
  </div>
</template>

<style scoped>
.mss-entry {
  border-bottom: var(--border-width-base, 1px) solid var(--border-color-subtle, #c8ccd1);
  background-color: var(--background-color-base, #fff);
}

.mss-entry:active {
  background-color: var(--background-color-interactive-subtle, #f8f9fa);
}

.mss-entry__hit {
  display: flex;
  flex-direction: column;
  gap: 0;
  width: 100%;
  padding: var(--spacing-50, 8px) var(--spacing-75, 12px);
  border: 0;
  background: none;
  text-align: start;
  font: inherit;
  color: var(--color-base, #202122);
  cursor: pointer;
}

.mss-entry__title {
  color: var(--color-progressive, #36c);
  font-weight: var(--font-weight-bold, 700);
  font-size: var(--font-size-medium, 1rem);
  line-height: var(--line-height-small, 1.375);
}

.mss-entry__row {
  display: flex;
  align-items: center;
  gap: var(--spacing-25, 4px);
}

.mss-entry__query {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  color: var(--color-subtle, #54595d);
  font-size: var(--font-size-medium, 1rem);
  line-height: var(--line-height-small, 1.375);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.mss-entry__button {
  flex-shrink: 0;
  min-width: 44px;
  min-height: 24px;
  height: 24px;
  padding-inline: var(--spacing-25, 6px);
  /* Decorative: the whole banner is the hit area. */
  pointer-events: none;
}
</style>
