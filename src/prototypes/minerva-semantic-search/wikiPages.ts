/**
 * Action API helpers for the search overlay: typeahead titles, related-article
 * suggestions for the empty state, and thumbnails for result attribution rows.
 */

import { wikiHostFromLang, wikimediaApiFetchHeaders } from '@/config'

export interface WikiPageSummary {
  pageid: number
  title: string
  description?: string
  thumbnailUrl?: string
}

interface ActionApiPage {
  pageid?: number
  title?: string
  description?: string
  thumbnail?: { source?: string }
  index?: number
}

interface ActionApiResponse {
  query?: { pages?: Record<string, ActionApiPage> }
}

const THUMB_SIZE = 120

function actionApiUrl(lang: string, params: Record<string, string>): string {
  const search = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    origin: '*',
    ...params,
  })
  return `https://${wikiHostFromLang(lang)}/w/api.php?${search.toString()}`
}

async function fetchPages(
  url: string,
  purpose: string,
  signal?: AbortSignal,
): Promise<WikiPageSummary[]> {
  const response = await fetch(url, {
    signal,
    headers: wikimediaApiFetchHeaders(purpose),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const data = (await response.json()) as ActionApiResponse & {
    query?: { pages?: ActionApiPage[] }
  }

  // formatversion=2 returns an array; guard for object form just in case.
  const rawPages = data.query?.pages
  const pages: ActionApiPage[] = Array.isArray(rawPages) ? rawPages : Object.values(rawPages ?? {})

  return pages
    .slice()
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .filter((page): page is ActionApiPage & { title: string } => typeof page.title === 'string')
    .map((page) => ({
      pageid: page.pageid ?? 0,
      title: page.title,
      description: page.description?.trim() || undefined,
      thumbnailUrl: page.thumbnail?.source,
    }))
}

export interface TypeaheadOptions {
  lang?: string
  limit?: number
  signal?: AbortSignal
}

/**
 * Typeahead suggestions with short descriptions and thumbnails.
 *
 * Title-prefix search first, as Minerva does. Question-shaped queries rarely
 * prefix-match any title, so an empty prefix result falls back to full-text
 * search — that keeps results updating on every keystroke.
 */
export async function fetchTypeaheadPages(
  query: string,
  options: TypeaheadOptions = {},
): Promise<WikiPageSummary[]> {
  const trimmed = query.trim()
  if (!trimmed.length) return []

  const lang = options.lang ?? 'en'
  const limit = String(options.limit ?? 8)

  const prefixUrl = actionApiUrl(lang, {
    generator: 'prefixsearch',
    gpssearch: trimmed,
    gpslimit: limit,
    prop: 'pageimages|description',
    piprop: 'thumbnail',
    pithumbsize: String(THUMB_SIZE),
    pilicense: 'any',
  })

  const prefixPages = await fetchPages(prefixUrl, 'semantic-search-typeahead', options.signal)
  if (prefixPages.length) return prefixPages

  const fullTextUrl = actionApiUrl(lang, {
    generator: 'search',
    gsrsearch: trimmed,
    gsrlimit: limit,
    gsrnamespace: '0',
    prop: 'pageimages|description',
    piprop: 'thumbnail',
    pithumbsize: String(THUMB_SIZE),
    pilicense: 'any',
  })

  return fetchPages(fullTextUrl, 'semantic-search-typeahead-fulltext', options.signal)
}

/**
 * Articles related to the one being read — the empty-state suggestions, built
 * from CirrusSearch's `morelike:` profile rather than a hardcoded list.
 */
export async function fetchRelatedPages(
  title: string,
  options: TypeaheadOptions = {},
): Promise<WikiPageSummary[]> {
  const trimmed = title.trim()
  if (!trimmed.length) return []

  const lang = options.lang ?? 'en'
  const url = actionApiUrl(lang, {
    generator: 'search',
    gsrsearch: `morelike:${trimmed}`,
    gsrlimit: String(options.limit ?? 3),
    gsrnamespace: '0',
    prop: 'pageimages|description',
    piprop: 'thumbnail',
    pithumbsize: String(THUMB_SIZE),
    pilicense: 'any',
  })

  return fetchPages(url, 'semantic-search-related', options.signal)
}

/** Thumbnails and descriptions for a batch of titles (result attribution rows). */
export async function fetchPageSummaries(
  titles: string[],
  options: { lang?: string; signal?: AbortSignal } = {},
): Promise<Map<string, WikiPageSummary>> {
  const unique = Array.from(new Set(titles.map((title) => title.trim()).filter(Boolean)))
  if (!unique.length) return new Map()

  const lang = options.lang ?? 'en'
  const url = actionApiUrl(lang, {
    titles: unique.join('|'),
    prop: 'pageimages|description',
    piprop: 'thumbnail',
    pithumbsize: String(THUMB_SIZE),
    pilicense: 'any',
    redirects: '1',
  })

  const pages = await fetchPages(url, 'semantic-search-summaries', options.signal)
  const byTitle = new Map<string, WikiPageSummary>()
  for (const page of pages) {
    byTitle.set(page.title, page)
  }

  // Index by requested title too, so redirect-normalized titles still resolve.
  for (const title of unique) {
    if (!byTitle.has(title)) {
      const match = pages.find(
        (page) => page.title.toLowerCase() === title.replace(/_/g, ' ').toLowerCase(),
      )
      if (match) byTitle.set(title, match)
    }
  }

  return byTitle
}

/** Mobile-web article URL for a title. */
export function articleUrl(title: string, lang = 'en'): string {
  return `https://${wikiHostFromLang(lang)}/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`
}

export interface ArticleSearchResult {
  pageid: number
  title: string
  /** Snippet markup, matched terms wrapped in `<span class="searchmatch">`. */
  snippetHtml: string
}

interface ActionApiSearchHit {
  pageid?: number
  title?: string
  snippet?: string
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Keep only the highlight spans CirrusSearch emits. Snippets go through
 * `v-html`, so everything else is reduced to its text.
 */
function sanitizeSnippet(snippet: string): string {
  const doc = new DOMParser().parseFromString(`<div>${snippet}</div>`, 'text/html')
  const root = doc.body.firstElementChild
  if (!root) return ''

  let html = ''
  for (const node of Array.from(root.childNodes)) {
    const text = escapeHtml(node.textContent ?? '')
    const isHighlight =
      node.nodeType === Node.ELEMENT_NODE && (node as Element).classList.contains('searchmatch')

    html += isHighlight ? `<span class="searchmatch">${text}</span>` : text
  }

  return html
}

/**
 * Full-text search, as `Special:Search` runs it. Snippets arrive with the
 * query's terms already marked up by CirrusSearch.
 */
export async function fetchArticleSearchResults(
  query: string,
  options: TypeaheadOptions = {},
): Promise<ArticleSearchResult[]> {
  const trimmed = query.trim()
  if (!trimmed.length) return []

  const lang = options.lang ?? 'en'
  const url = actionApiUrl(lang, {
    list: 'search',
    srsearch: trimmed,
    srlimit: String(options.limit ?? 10),
    srnamespace: '0',
    srprop: 'snippet',
  })

  const response = await fetch(url, {
    signal: options.signal,
    headers: wikimediaApiFetchHeaders('semantic-search-fulltext'),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const data = (await response.json()) as { query?: { search?: ActionApiSearchHit[] } }

  return (data.query?.search ?? [])
    .filter((hit): hit is ActionApiSearchHit & { title: string } => typeof hit.title === 'string')
    .map((hit) => ({
      pageid: hit.pageid ?? 0,
      title: hit.title,
      snippetHtml: sanitizeSnippet(hit.snippet ?? ''),
    }))
}
