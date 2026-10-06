<script setup lang="ts">
/**
 * One semantic answer: the highlighted article passage, then where it came
 * from — article, section, and attribution signals.
 */
import { computed } from 'vue'
import { CdxIcon } from '@wikimedia/codex'
import { cdxIconQuotes } from '@wikimedia/codex-icons'

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
      <span class="mss-card__source-title">{{ props.answer.title }}</span>
      <span v-if="props.answer.section" class="mss-card__source-section">
        ↪ {{ props.answer.section }}
      </span>
      <span v-if="attribution" class="mss-card__source-meta">{{ attribution }}</span>
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
  position: relative;
  display: block;
}

/* Sits in the passage's first line, which indents to clear it. */
.mss-card__quote-icon {
  position: absolute;
  top: 3px;
  inset-inline-start: 5px;
  color: var(--color-base, #202122);
}

.mss-card__passage {
  display: block;
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
  /* Codex Blockquote type: 16px on a 26px line. */
  font-family: var(--font-family-serif, 'Source Serif 4', serif);
  font-size: var(--font-size-medium, 1rem);
  line-height: var(--line-height-medium, 1.625);
}

/* Opens a gap in the first line for the quote mark. */
.mss-card__highlight::before {
  content: '';
  display: inline-block;
  width: 26px;
}

.mss-card__source {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  width: 100%;
  padding: var(--spacing-50, 8px) 0 0 var(--spacing-50, 8px);
  border-top: var(--border-width-base, 1px) solid var(--border-color-muted, #dadde3);
  font-size: var(--font-size-small, 0.875rem);
}

.mss-card__source-title {
  color: var(--color-progressive, #36c);
  font-weight: var(--font-weight-bold, 700);
  line-height: var(--line-height-x-small, 1.25);
}

.mss-card__source-section,
.mss-card__source-meta {
  color: var(--color-subtle, #54595d);
  line-height: var(--line-height-small, 1.375);
}
</style>
