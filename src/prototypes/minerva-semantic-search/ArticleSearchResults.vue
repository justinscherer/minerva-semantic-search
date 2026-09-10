<script setup lang="ts">
/**
 * Full-text search results, laid out as `Special:Search` does: article title as
 * a link over a snippet with the query's terms bolded.
 */
import type { ArticleSearchResult } from './wikiPages'
import { articleUrl } from './wikiPages'

interface Props {
  results: ArticleSearchResult[]
  lang?: string
}

const props = withDefaults(defineProps<Props>(), { lang: 'en' })

const emit = defineEmits<{
  (event: 'select', result: ArticleSearchResult): void
}>()
</script>

<template>
  <ul class="mss-articles">
    <li v-for="result in props.results" :key="`${result.pageid}-${result.title}`">
      <a
        class="mss-articles__item"
        :href="articleUrl(result.title, props.lang)"
        @click.prevent="emit('select', result)"
      >
        <span class="mss-articles__title">{{ result.title }}</span>
        <!-- Snippet markup comes from CirrusSearch, reduced to `searchmatch`
             spans in `fetchArticleSearchResults`. -->
        <!-- eslint-disable-next-line vue/no-v-html -->
        <span class="mss-articles__snippet" v-html="result.snippetHtml" />
      </a>
    </li>
  </ul>
</template>

<style scoped>
.mss-articles {
  list-style: none;
  margin: 0;
  padding: 0;
}

.mss-articles__item {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-25, 4px);
  box-sizing: border-box;
  width: 100%;
  padding: var(--spacing-50, 8px) var(--spacing-75, 12px);
  text-decoration: none;
}

.mss-articles__item:hover {
  text-decoration: none;
}

.mss-articles__item:active {
  background-color: var(--background-color-interactive-subtle, #f8f9fa);
}

.mss-articles__title {
  color: var(--color-progressive, #36c);
  font-weight: var(--font-weight-bold, 700);
  font-size: var(--font-size-medium, 1rem);
  line-height: var(--line-height-small, 1.375);
}

.mss-articles__snippet {
  color: var(--color-subtle, #54595d);
  font-size: var(--font-size-small, 0.875rem);
  line-height: var(--line-height-x-small, 1.25);
}

.mss-articles__snippet :deep(.searchmatch) {
  color: var(--color-base, #202122);
  font-weight: var(--font-weight-bold, 700);
}
</style>
