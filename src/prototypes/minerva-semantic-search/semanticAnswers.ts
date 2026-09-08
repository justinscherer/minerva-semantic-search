/**
 * Assembles the semantic results page: semantic hits from ask.toolforge.org,
 * passages pulled out of the live articles, and the attribution signals shown
 * under each quote.
 */

import { fetchContributorCount } from '@/components/attribution/fetchContributorCount'
import { wikiHostFromLang } from '@/config'

import { askSearch, dedupeBySegment, type AskSearchResult } from './askApi'
import { fetchArticleDocument, resolvePassage, type ArticleDocument } from './passages'
import { articleUrl, fetchPageSummaries, type WikiPageSummary } from './wikiPages'

export interface SemanticAnswer {
  id: string
  /** Indexed question the query matched. */
  question: string
  /** Article prose backing the answer. */
  passage: string
  /** `true` when the passage came from a whole-article fallback search. */
  approximate: boolean
  title: string
  language: string
  url: string
  thumbnailUrl?: string
  description?: string
  contributors: number | null
  references: number | null
}

export interface SemanticSearchOptions {
  lang?: string
  limit?: number
  signal?: AbortSignal
}

interface ArticleKey {
  title: string
  language: string
}

function articleKeyOf(result: AskSearchResult): string {
  return `${result.language}:${result.title}`
}

/** Parsed articles keyed by language+title, so hits in one article share a fetch. */
async function loadArticles(
  keys: ArticleKey[],
  signal?: AbortSignal,
): Promise<Map<string, ArticleDocument>> {
  const entries = await Promise.all(
    keys.map(async (key) => {
      try {
        const article = await fetchArticleDocument(key.title, { lang: key.language, signal })
        return [`${key.language}:${key.title}`, article] as const
      } catch {
        return null
      }
    }),
  )

  return new Map(entries.filter((entry): entry is NonNullable<typeof entry> => entry !== null))
}

async function loadContributorCounts(
  keys: ArticleKey[],
  signal?: AbortSignal,
): Promise<Map<string, number | null>> {
  const entries = await Promise.all(
    keys.map(async (key) => {
      try {
        const count = await fetchContributorCount(key.title, {
          signal,
          host: wikiHostFromLang(key.language),
        })
        return [`${key.language}:${key.title}`, count] as const
      } catch {
        return [`${key.language}:${key.title}`, null] as const
      }
    }),
  )

  return new Map(entries)
}

async function loadSummaries(
  keys: ArticleKey[],
  signal?: AbortSignal,
): Promise<Map<string, WikiPageSummary>> {
  const byLanguage = new Map<string, string[]>()
  for (const key of keys) {
    const titles = byLanguage.get(key.language) ?? []
    titles.push(key.title)
    byLanguage.set(key.language, titles)
  }

  const merged = new Map<string, WikiPageSummary>()
  await Promise.all(
    Array.from(byLanguage.entries()).map(async ([language, titles]) => {
      try {
        const summaries = await fetchPageSummaries(titles, { lang: language, signal })
        for (const [title, summary] of summaries) {
          merged.set(`${language}:${title}`, summary)
        }
      } catch {
        // Attribution rows degrade to no thumbnail.
      }
    }),
  )

  return merged
}

/**
 * Run a semantic search and hydrate each hit into a quote card's worth of data.
 * Returns an empty array when the query matches nothing in the index.
 */
export async function fetchSemanticAnswers(
  query: string,
  options: SemanticSearchOptions = {},
): Promise<SemanticAnswer[]> {
  const { lang = 'en', limit = 6, signal } = options

  const hits = dedupeBySegment(await askSearch(query, { language: lang, signal }), limit)
  if (!hits.length) return []

  const keys: ArticleKey[] = []
  const seenKeys = new Set<string>()
  for (const hit of hits) {
    const key = articleKeyOf(hit)
    if (seenKeys.has(key)) continue
    seenKeys.add(key)
    keys.push({ title: hit.title, language: hit.language })
  }

  const [articles, contributors, summaries] = await Promise.all([
    loadArticles(keys, signal),
    loadContributorCounts(keys, signal),
    loadSummaries(keys, signal),
  ])

  const answers: SemanticAnswer[] = []

  for (const hit of hits) {
    const key = articleKeyOf(hit)
    const article = articles.get(key)
    if (!article) continue

    const passage = resolvePassage(article, hit.segment_id, hit.question)
    if (!passage) continue

    const summary = summaries.get(key)

    answers.push({
      id: `${key}:${hit.segment_id}`,
      question: hit.question,
      passage: passage.text,
      approximate: passage.approximate,
      title: hit.title,
      language: hit.language,
      url: articleUrl(hit.title, hit.language),
      thumbnailUrl: summary?.thumbnailUrl,
      description: summary?.description,
      contributors: contributors.get(key) ?? null,
      references: article.referenceCount,
    })
  }

  return answers
}

function pluralize(count: number, noun: string): string {
  return `${count.toLocaleString()} ${noun}${count === 1 ? '' : 's'}`
}

/** "1,573 contributors • 42 references", skipping signals we couldn't load. */
export function formatAttributionLine(answer: SemanticAnswer): string {
  const parts: string[] = []

  if (typeof answer.contributors === 'number') {
    parts.push(pluralize(answer.contributors, 'contributor'))
  }
  if (typeof answer.references === 'number' && answer.references > 0) {
    parts.push(pluralize(answer.references, 'reference'))
  }

  return parts.join(' • ')
}
