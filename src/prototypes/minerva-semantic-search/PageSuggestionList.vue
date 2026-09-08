<script setup lang="ts">
/**
 * Typeahead / empty-state list of article suggestions: thumbnail, title,
 * short description.
 */
import { CdxIcon } from '@wikimedia/codex'
import { cdxIconImage } from '@wikimedia/codex-icons'

import type { WikiPageSummary } from './wikiPages'

interface Props {
  pages: WikiPageSummary[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (event: 'select', page: WikiPageSummary): void
}>()
</script>

<template>
  <ul class="mss-suggestions">
    <li v-for="page in props.pages" :key="`${page.pageid}-${page.title}`">
      <button type="button" class="mss-suggestions__item" @click="emit('select', page)">
        <span class="mss-suggestions__thumb">
          <img v-if="page.thumbnailUrl" :src="page.thumbnailUrl" alt="" width="40" height="40" />
          <CdxIcon v-else :icon="cdxIconImage" size="small" />
        </span>
        <span class="mss-suggestions__text">
          <span class="mss-suggestions__title">{{ page.title }}</span>
          <span v-if="page.description" class="mss-suggestions__description">
            {{ page.description }}
          </span>
        </span>
      </button>
    </li>
  </ul>
</template>

<style scoped>
.mss-suggestions {
  list-style: none;
  margin: 0;
  padding: 0;
}

.mss-suggestions__item {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-50, 8px);
  box-sizing: border-box;
  width: 100%;
  padding: var(--spacing-50, 8px) var(--spacing-75, 12px);
  border: 0;
  border-bottom: var(--border-width-base, 1px) solid var(--border-color-muted, #dadde3);
  background: none;
  text-align: start;
  font: inherit;
  color: var(--color-base, #202122);
  cursor: pointer;
}

.mss-suggestions__item:active {
  background-color: var(--background-color-interactive-subtle, #f8f9fa);
}

.mss-suggestions__thumb {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: var(--size-250, 40px);
  height: var(--size-250, 40px);
  overflow: hidden;
  border: var(--border-width-base, 1px) solid var(--border-color-subtle, #c8ccd1);
  border-radius: var(--border-radius-base, 2px);
  background-color: var(--background-color-neutral-subtle, #f8f9fa);
  color: var(--color-subtle, #54595d);
}

.mss-suggestions__thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mss-suggestions__text {
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  flex-direction: column;
}

.mss-suggestions__title {
  font-size: var(--font-size-medium, 1rem);
  line-height: var(--line-height-x-small, 1.25);
}

.mss-suggestions__description {
  overflow: hidden;
  color: var(--color-subtle, #54595d);
  font-size: var(--font-size-small, 0.875rem);
  line-height: var(--line-height-small, 1.375);
  white-space: nowrap;
  text-overflow: ellipsis;
}
</style>
