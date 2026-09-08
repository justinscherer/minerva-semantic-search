<script setup lang="ts">
/** Placeholder quote card shown while the semantic search resolves. */
import { CdxIcon } from '@wikimedia/codex'
import { cdxIconQuotes } from '@wikimedia/codex-icons'
</script>

<template>
  <div class="mss-skeleton" aria-hidden="true">
    <div class="mss-skeleton__quote">
      <CdxIcon class="mss-skeleton__icon" :icon="cdxIconQuotes" size="small" />
      <div class="mss-skeleton__lines">
        <span class="mss-skeleton__line" />
        <span class="mss-skeleton__line mss-skeleton__line--95" />
        <span class="mss-skeleton__line mss-skeleton__line--90" />
        <span class="mss-skeleton__line mss-skeleton__line--85" />
        <span class="mss-skeleton__line mss-skeleton__line--30" />
      </div>
    </div>

    <div class="mss-skeleton__source">
      <span class="mss-skeleton__thumb" />
      <div class="mss-skeleton__source-lines">
        <span class="mss-skeleton__line mss-skeleton__line--35" />
        <span class="mss-skeleton__line mss-skeleton__line--70" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.mss-skeleton {
  display: flex;
  flex-direction: column;
  gap: 10px;
  box-sizing: border-box;
  padding: var(--spacing-75, 13px);
  border: var(--border-width-base, 1px) solid var(--border-color-base, #a2a9b1);
  border-radius: var(--border-radius-base, 2px);
  background-color: var(--background-color-base, #fff);
}

.mss-skeleton__quote {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.mss-skeleton__icon {
  color: var(--color-base, #202122);
}

.mss-skeleton__lines {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-inline: var(--spacing-50, 8px);
}

.mss-skeleton__line {
  display: block;
  width: 100%;
  height: 16px;
  border-radius: var(--border-radius-base, 2px);
  background-color: var(--color-disabled, #a2a9b1);
  animation: mss-skeleton-pulse 1.4s ease-in-out infinite;
}

.mss-skeleton__line--95 {
  width: 95%;
}

.mss-skeleton__line--90 {
  width: 90%;
}

.mss-skeleton__line--85 {
  width: 84%;
}

.mss-skeleton__line--70 {
  width: 70%;
}

.mss-skeleton__line--35 {
  width: 35%;
}

.mss-skeleton__line--30 {
  width: 30%;
}

.mss-skeleton__source {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-50, 8px);
  padding: var(--spacing-50, 8px) 0 0 var(--spacing-50, 8px);
  border-top: var(--border-width-base, 1px) solid var(--border-color-muted, #dadde3);
}

.mss-skeleton__thumb {
  flex-shrink: 0;
  box-sizing: border-box;
  width: var(--size-250, 40px);
  height: var(--size-250, 40px);
  border: var(--border-width-base, 1px) solid var(--border-color-subtle, #c8ccd1);
  border-radius: var(--border-radius-base, 2px);
  background-color: var(--background-color-neutral-subtle, #f8f9fa);
}

.mss-skeleton__source-lines {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 6px;
}

@keyframes mss-skeleton-pulse {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.55;
  }
}

@media (prefers-reduced-motion: reduce) {
  .mss-skeleton__line {
    animation: none;
  }
}
</style>
