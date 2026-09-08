<script setup lang="ts">
/**
 * One semantic answer: the highlighted article passage, then the article it
 * came from with its attribution signals.
 */
import { computed } from 'vue'
import { CdxIcon } from '@wikimedia/codex'
import { cdxIconImage, cdxIconQuotes } from '@wikimedia/codex-icons'

import { formatAttributionLine, type SemanticAnswer } from './semanticAnswers'

interface Props {
  answer: SemanticAnswer
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (event: 'select', answer: SemanticAnswer): void
}>()

const attribution = computed(() => formatAttributionLine(props.answer))
</script>

<template>
  <!-- The whole card is the link: it opens the article at this passage. -->
  <a
    class="mss-card"
    :href="props.answer.url"
    :title="props.answer.question"
    @click.prevent="emit('select', props.answer)"
  >
    <span class="mss-card__quote">
      <CdxIcon class="mss-card__quote-icon" :icon="cdxIconQuotes" size="small" />
      <span class="mss-card__passage">
        <span class="mss-card__highlight">{{ props.answer.passage }}</span>
      </span>
    </span>

    <span class="mss-card__source">
      <span class="mss-card__thumb">
        <img
          v-if="props.answer.thumbnailUrl"
          :src="props.answer.thumbnailUrl"
          alt=""
          width="40"
          height="40"
        />
        <CdxIcon v-else :icon="cdxIconImage" size="small" />
      </span>
      <span class="mss-card__source-text">
        <span class="mss-card__source-title">{{ props.answer.title }}</span>
        <span v-if="attribution" class="mss-card__source-meta">{{ attribution }}</span>
      </span>
    </span>
  </a>
</template>

<style scoped>
.mss-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  box-sizing: border-box;
  padding: var(--spacing-75, 13px);
  border: var(--border-width-base, 1px) solid var(--border-color-base, #a2a9b1);
  border-radius: var(--border-radius-base, 2px);
  background-color: var(--background-color-base, #fff);
  color: var(--color-base, #202122);
  text-decoration: none;
  cursor: pointer;
}

.mss-card:hover,
.mss-card:visited {
  color: var(--color-base, #202122);
  text-decoration: none;
}

.mss-card:active {
  background-color: var(--background-color-interactive-subtle, #f8f9fa);
}

.mss-card__quote {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.mss-card__quote-icon {
  color: var(--color-base, #202122);
}

.mss-card__passage {
  margin: 0;
  padding: 0 var(--spacing-50, 8px) 2px;
}

.mss-card__highlight {
  /* Highlight follows the text's line boxes, matching the design's marker look. */
  box-decoration-break: clone;
  padding: 1px 0;
  background-color: var(--background-color-warning-subtle, #fdf2d5);
  box-shadow:
    0.15em 0 0 var(--background-color-warning-subtle, #fdf2d5),
    -0.15em 0 0 var(--background-color-warning-subtle, #fdf2d5);
  color: var(--color-base, #202122);
  font-family: var(--font-family-serif, 'Source Serif 4', serif);
  /* Codex Blockquote type: 16px on a 26px line. */
  font-size: var(--font-size-medium, 1rem);
  line-height: var(--line-height-medium, 1.625);
}

.mss-card__source {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-50, 8px);
  box-sizing: border-box;
  width: 100%;
  padding: var(--spacing-50, 8px) 0 0 var(--spacing-50, 8px);
  border: 0;
  border-top: var(--border-width-base, 1px) solid var(--border-color-muted, #dadde3);
  background: none;
  text-align: start;
  font: inherit;
  cursor: pointer;
}

.mss-card__thumb {
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

.mss-card__thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mss-card__source-text {
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  flex-direction: column;
  font-size: var(--font-size-small, 0.875rem);
}

.mss-card__source-title {
  color: var(--color-base, #202122);
  line-height: var(--line-height-x-small, 1.25);
}

.mss-card__source-meta {
  color: var(--color-subtle, #54595d);
  line-height: var(--line-height-small, 1.375);
}
</style>
