<script setup lang="ts">
definePage({
  meta: {
    title: 'Minerva semantic search',
    description:
      'Mobile web search with a semantic search entry point, answering questions with quoted article passages.',
    supportingText: 'Live data from ask.toolforge.org',
    category: 'prototype',
    platform: 'web',
  },
})

import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { CdxIcon, CdxMessage, CdxProgressBar } from '@wikimedia/codex'
import { cdxIconQuotes } from '@wikimedia/codex-icons'

import ArticleLive from '@/components/article/ArticleLive.vue'
import ChromeHeader from '@/components/chrome/ChromeHeader.vue'
import ChromeWrapper from '@/components/chrome/ChromeWrapper.vue'
import MobileWrapper from '@/components/MobileWrapper.vue'
import type { HeaderItem } from '@/components/header/headerItems'

import PageSuggestionList from './PageSuggestionList.vue'
import QuoteCard from './QuoteCard.vue'
import QuoteCardSkeleton from './QuoteCardSkeleton.vue'
import SearchHeader from './SearchHeader.vue'
import SemanticEntryPoint from './SemanticEntryPoint.vue'
import { askArticles, askQuestions, isReadableIndexTitle, normalizeIndexTitle } from './askApi'
import { clearPassageHighlight, highlightPassage } from './highlightPassage'
import { fetchSemanticAnswers, type SemanticAnswer } from './semanticAnswers'
import { fetchRelatedPages, fetchTypeaheadPages, type WikiPageSummary } from './wikiPages'

/** Stand-in when the index can't be listed — `Cat` is reliably indexed. */
const FALLBACK_ARTICLE = 'Cat'
const TYPEAHEAD_DEBOUNCE_MS = 180
const SKELETON_COUNT = 3

type Screen = 'article' | 'search'
type SearchView = 'suggestions' | 'typeahead' | 'semantic'

const route = useRoute()

const lang = computed(() => (typeof route.query.lang === 'string' ? route.query.lang : 'en'))

const routeArticle =
  typeof route.query.article === 'string' && route.query.article.trim().length
    ? route.query.article.trim()
    : null

/** Empty until a random indexed article is picked (or `?article=` pins one). */
const articleTitle = ref(routeArticle ?? '')

const screen = ref<Screen>('search')
const searchView = ref<SearchView>('suggestions')
const query = ref('')

const relatedPages = ref<WikiPageSummary[]>([])
const typeaheadPages = ref<WikiPageSummary[]>([])

const semanticQuery = ref('')
const answers = ref<SemanticAnswer[]>([])
const isSearching = ref(false)
const searchError = ref<string | null>(null)
const examples = ref<string[]>([])
/** Passage to mark and scroll to once the next article body renders. */
const pendingPassage = ref<string | null>(null)

let typeaheadAbort: AbortController | null = null
let semanticAbort: AbortController | null = null
let relatedAbort: AbortController | null = null
let debounceHandle: ReturnType<typeof setTimeout> | undefined

const trimmedQuery = computed(() => query.value.trim())
const showEntryPoint = computed(() => trimmedQuery.value.length >= 3)
const hasNoAnswers = computed(
  () =>
    searchView.value === 'semantic' &&
    !isSearching.value &&
    !searchError.value &&
    !answers.value.length,
)

const articleHeaderRight = computed((): HeaderItem[] => [
  { type: 'button', icon: 'search', label: 'Search', onClick: openSearch },
  { type: 'button', icon: 'bell-outline', label: 'Notifications' },
  { type: 'button', icon: 'user-avatar-outline', label: 'User menu' },
])

function openSearch(): void {
  screen.value = 'search'
  searchView.value = trimmedQuery.value.length ? 'typeahead' : 'suggestions'
  void loadRelatedPages()
}

/** Back button: step out of the answers page first, then close the overlay. */
function onBack(): void {
  if (searchView.value === 'semantic') {
    searchView.value = trimmedQuery.value.length ? 'typeahead' : 'suggestions'
    return
  }
  screen.value = 'article'
}

async function loadRelatedPages(): Promise<void> {
  if (relatedPages.value.length || !articleTitle.value) return

  relatedAbort?.abort()
  relatedAbort = new AbortController()

  try {
    relatedPages.value = await fetchRelatedPages(articleTitle.value, {
      lang: lang.value,
      limit: 3,
      signal: relatedAbort.signal,
    })
  } catch {
    relatedPages.value = []
  }
}

/**
 * Pick the article to read behind the search overlay: a random one from the
 * semantic index, so every load starts on a page whose answers are searchable.
 */
async function pickIndexedArticle(): Promise<void> {
  if (articleTitle.value) return

  try {
    const indexed = (await askArticles()).filter(
      (article) => article.language === lang.value && isReadableIndexTitle(article.title),
    )
    if (!indexed.length) {
      articleTitle.value = FALLBACK_ARTICLE
      return
    }

    const pick = indexed[Math.floor(Math.random() * indexed.length)]
    articleTitle.value = normalizeIndexTitle(pick.title)
  } catch {
    articleTitle.value = FALLBACK_ARTICLE
  }
}

async function runTypeahead(value: string): Promise<void> {
  typeaheadAbort?.abort()
  typeaheadAbort = new AbortController()
  const { signal } = typeaheadAbort

  try {
    const pages = await fetchTypeaheadPages(value, { lang: lang.value, limit: 8, signal })
    if (signal.aborted) return
    typeaheadPages.value = pages
  } catch {
    if (!signal.aborted) typeaheadPages.value = []
  }
}

watch(query, (value) => {
  const trimmed = value.trim()

  if (searchView.value === 'semantic' && trimmed !== semanticQuery.value) {
    searchView.value = trimmed.length ? 'typeahead' : 'suggestions'
  } else if (searchView.value !== 'semantic') {
    searchView.value = trimmed.length ? 'typeahead' : 'suggestions'
  }

  if (debounceHandle) clearTimeout(debounceHandle)

  if (!trimmed.length) {
    typeaheadAbort?.abort()
    typeaheadPages.value = []
    return
  }

  debounceHandle = setTimeout(() => {
    void runTypeahead(trimmed)
  }, TYPEAHEAD_DEBOUNCE_MS)
})

/** Example questions from the semantic index, shown when a query matches nothing. */
async function loadExamples(): Promise<void> {
  if (examples.value.length) return

  try {
    const indexed = (await askArticles()).filter(
      (article) => article.language === lang.value && isReadableIndexTitle(article.title),
    )
    if (!indexed.length) return

    const pick = indexed[Math.floor(Math.random() * indexed.length)]
    const questions = await askQuestions(pick.language, pick.title)
    examples.value = questions.slice(0, 3).map((entry) => entry.question)
  } catch {
    examples.value = []
  }
}

async function runSemanticSearch(value: string): Promise<void> {
  const trimmed = value.trim()
  if (!trimmed.length) return

  semanticAbort?.abort()
  semanticAbort = new AbortController()
  const { signal } = semanticAbort

  semanticQuery.value = trimmed
  searchView.value = 'semantic'
  isSearching.value = true
  searchError.value = null
  answers.value = []

  try {
    const found = await fetchSemanticAnswers(trimmed, { lang: lang.value, signal })
    if (signal.aborted) return
    answers.value = found
    if (!found.length) void loadExamples()
  } catch (error) {
    if (signal.aborted) return
    searchError.value = error instanceof Error ? error.message : 'Semantic search failed.'
  } finally {
    if (!signal.aborted) isSearching.value = false
  }
}

function onSubmit(value: string): void {
  if (debounceHandle) clearTimeout(debounceHandle)
  void runSemanticSearch(value)
}

function openArticle(title: string, passage: string | null = null): void {
  articleTitle.value = title
  relatedPages.value = []
  pendingPassage.value = passage
  screen.value = 'article'
}

function onSelectPage(page: WikiPageSummary): void {
  openArticle(page.title)
}

function onSelectAnswer(answer: SemanticAnswer): void {
  openArticle(answer.title, answer.passage)
}

/**
 * Mark and scroll to the passage a result card quoted, once the article body is
 * in the DOM. Falls back to the top of the article if the passage isn't found —
 * the article may have been edited since the semantic index was built.
 */
function onParserReady(root: HTMLElement): void {
  clearPassageHighlight(root)

  const passage = pendingPassage.value
  pendingPassage.value = null
  if (!passage) return

  const mark = highlightPassage(root, passage)
  if (!mark) return

  requestAnimationFrame(() => {
    mark.scrollIntoView({ block: 'center', behavior: 'smooth' })
  })
}

function onSelectExample(question: string): void {
  query.value = question
  void runSemanticSearch(question)
}

// Empty-state suggestions follow whichever article is being read.
watch(articleTitle, () => {
  relatedPages.value = []
  void loadRelatedPages()
})

onBeforeUnmount(() => {
  if (debounceHandle) clearTimeout(debounceHandle)
  typeaheadAbort?.abort()
  semanticAbort?.abort()
  relatedAbort?.abort()
})

void pickIndexedArticle()
void loadRelatedPages()
</script>

<template>
  <MobileWrapper>
    <ChromeWrapper v-if="screen === 'article'" class="mss-article" skin="mobile">
      <template #header>
        <ChromeHeader skin="mobile" :right="articleHeaderRight" />
      </template>
      <!-- Held back until the random indexed article is picked, so ArticleLive
           doesn't fall through to its own random (unindexed) article. -->
      <ArticleLive
        v-if="articleTitle"
        :article="articleTitle"
        :lang="lang"
        @parser-ready="onParserReady"
      />
      <CdxProgressBar v-else class="mss-article__loading" :aria-label="'Loading article'" />
    </ChromeWrapper>

    <div v-else class="mss" data-skin="mobile">
      <SearchHeader v-model="query" :loading="isSearching" @submit="onSubmit" @back="onBack" />

      <div class="mss__body">
        <template v-if="searchView === 'suggestions'">
          <PageSuggestionList :pages="relatedPages" @select="onSelectPage" />
        </template>

        <template v-else-if="searchView === 'typeahead'">
          <SemanticEntryPoint
            v-if="showEntryPoint"
            :query="trimmedQuery"
            @find="runSemanticSearch"
          />
          <PageSuggestionList :pages="typeaheadPages" @select="onSelectPage" />
        </template>

        <template v-else>
          <div class="mss__question">
            <CdxIcon class="mss__question-icon" :icon="cdxIconQuotes" size="small" />
            <p class="mss__question-text">
              {{ semanticQuery }}
            </p>
          </div>

          <div class="mss__answers">
            <template v-if="isSearching">
              <QuoteCardSkeleton v-for="index in SKELETON_COUNT" :key="`skeleton-${index}`" />
            </template>

            <template v-else>
              <CdxMessage v-if="searchError" type="error" :allow-user-dismiss="false">
                {{ searchError }}
              </CdxMessage>

              <template v-if="hasNoAnswers">
                <CdxMessage type="notice" :allow-user-dismiss="false">
                  No indexed answers for “{{ semanticQuery }}”. The semantic index covers a small
                  set of articles so far.
                </CdxMessage>

                <div v-if="examples.length" class="mss__examples">
                  <p class="mss__examples-title">Try a question that is in the index</p>
                  <button
                    v-for="example in examples"
                    :key="example"
                    type="button"
                    class="mss__example"
                    @click="onSelectExample(example)"
                  >
                    {{ example }}
                  </button>
                </div>
              </template>

              <QuoteCard
                v-for="answer in answers"
                :key="answer.id"
                :answer="answer"
                @select="onSelectAnswer"
              />
            </template>
          </div>
        </template>
      </div>
    </div>
  </MobileWrapper>
</template>

<style scoped>
.mss-article__loading {
  margin: var(--spacing-200, 32px) var(--spacing-100, 16px);
}

/* Marks are injected into the rendered article, so they need `:deep`. */
.mss-article :deep(mark.mss-passage-highlight) {
  padding: 1px 0;
  background-color: var(--background-color-warning-subtle, #fdf2d5);
  box-shadow:
    0.15em 0 0 var(--background-color-warning-subtle, #fdf2d5),
    -0.15em 0 0 var(--background-color-warning-subtle, #fdf2d5);
  color: inherit;
  animation: mss-highlight-in 900ms ease-out;
}

@keyframes mss-highlight-in {
  from {
    background-color: var(--background-color-warning, #ffcc33);
  }

  to {
    background-color: var(--background-color-warning-subtle, #fdf2d5);
  }
}

@media (prefers-reduced-motion: reduce) {
  .mss-article :deep(mark.mss-passage-highlight) {
    animation: none;
  }
}

.mss {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 100vh;
  background-color: var(--background-color-base, #fff);
  color: var(--color-base, #202122);
}

.mss__body {
  flex: 1 1 auto;
}

.mss__question {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-50, 8px);
  padding: var(--spacing-50, 8px) var(--spacing-100, 16px);
  border-bottom: var(--border-width-base, 1px) solid var(--border-color-subtle, #c8ccd1);
}

.mss__question-icon {
  flex-shrink: 0;
  margin-top: 2px;
  color: var(--color-subtle, #54595d);
}

.mss__question-text {
  margin: 0;
  font-size: var(--font-size-medium, 1rem);
  line-height: var(--line-height-small, 1.375);
}

.mss__answers {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-75, 12px);
  padding: var(--spacing-75, 12px) var(--spacing-100, 16px) var(--spacing-200, 32px);
}

.mss__examples {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-25, 4px);
}

.mss__examples-title {
  margin: 0;
  color: var(--color-subtle, #54595d);
  font-size: var(--font-size-small, 0.875rem);
}

.mss__example {
  padding: var(--spacing-50, 8px) 0;
  border: 0;
  border-bottom: var(--border-width-base, 1px) solid var(--border-color-muted, #dadde3);
  background: none;
  text-align: start;
  color: var(--color-progressive, #36c);
  font: inherit;
  cursor: pointer;
}
</style>
