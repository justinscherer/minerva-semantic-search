/**
 * Client for the Wikimedia semantic search API (https://ask.toolforge.org/api/docs).
 *
 * The API matches a natural-language query against LLM-generated questions that
 * were indexed per article segment. It returns the matched *question* plus a
 * `segment_id`, not the passage itself — see `passages.ts` for turning a
 * `segment_id` back into article prose.
 */

const ASK_API_BASE = 'https://ask.toolforge.org/api'

export interface AskSearchResult {
  article_id: number
  title: string
  language: string
  /** Indexed question that matched the query. */
  question: string
  /** Parsoid element id marking the article segment the question came from. */
  segment_id: string
  /** Relevance score, 0–1. */
  rank: number
}

export interface AskArticle {
  id: number
  language: string
  title: string
}

export interface AskQuestion {
  id: number
  segment_id: string
  question: string
}

export class AskApiError extends Error {
  constructor(
    message: string,
    public readonly code: 'http' | 'api' | 'shape',
  ) {
    super(message)
    this.name = 'AskApiError'
  }
}

interface AskEnvelope<T> {
  success: boolean
  data: T | null
  error: string | null
}

async function askFetch<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${ASK_API_BASE}${path}`, { signal })

  if (!response.ok) {
    throw new AskApiError(`HTTP ${response.status}`, 'http')
  }

  const raw = (await response.json()) as AskEnvelope<T>
  if (typeof raw !== 'object' || raw === null) {
    throw new AskApiError('Unexpected response shape', 'shape')
  }
  if (!raw.success) {
    throw new AskApiError(raw.error ?? 'Semantic search failed', 'api')
  }

  return (raw.data ?? []) as T
}

export interface AskSearchOptions {
  language?: string
  signal?: AbortSignal
}

/** Semantic search across indexed articles. Empty array when nothing matches. */
export async function askSearch(
  query: string,
  options: AskSearchOptions = {},
): Promise<AskSearchResult[]> {
  const trimmed = query.trim()
  if (!trimmed.length) return []

  const params = new URLSearchParams({ q: trimmed, language: options.language ?? 'en' })
  return askFetch<AskSearchResult[]>(`/search?${params.toString()}`, options.signal)
}

export interface AskAutocompleteOptions extends AskSearchOptions {
  limit?: number
}

/** Indexed questions that start with / relate to the partial query. */
export async function askAutocomplete(
  query: string,
  options: AskAutocompleteOptions = {},
): Promise<string[]> {
  const trimmed = query.trim()
  if (!trimmed.length) return []

  const params = new URLSearchParams({
    q: trimmed,
    language: options.language ?? 'en',
    limit: String(options.limit ?? 10),
  })
  return askFetch<string[]>(`/autocomplete?${params.toString()}`, options.signal)
}

/** Every article currently in the semantic index (~50 at time of writing). */
export async function askArticles(signal?: AbortSignal): Promise<AskArticle[]> {
  return askFetch<AskArticle[]>('/list/articles', signal)
}

/** All indexed questions for one article — useful for seeding example prompts. */
export async function askQuestions(
  language: string,
  title: string,
  signal?: AbortSignal,
): Promise<AskQuestion[]> {
  const path = `/list/questions/${encodeURIComponent(language)}/${encodeURIComponent(title)}`
  return askFetch<AskQuestion[]>(path, signal)
}

/**
 * Index titles we don't open as a reading page. All of them resolve on the
 * wikis, but they read as broken or redundant:
 * - `Earphone` and `Birds of Thailand` are redirects to articles the index
 *   already lists separately (`Headphones`, `List of birds of Thailand`).
 * - `J R R Tolkein` is a misspelling; the article header would show it verbatim.
 */
const SKIPPED_INDEX_TITLES = new Set(['Earphone', 'Birds of Thailand', 'J R R Tolkein'])

/** Index titles carry wikitext underscores in places. */
export function normalizeIndexTitle(title: string): string {
  return title.replace(/_/g, ' ').trim()
}

/**
 * Whether an indexed article works as a page to land on. Excludes the skip
 * list plus list articles, which have little prose to quote or read.
 */
export function isReadableIndexTitle(title: string): boolean {
  const normalized = normalizeIndexTitle(title)
  return !SKIPPED_INDEX_TITLES.has(normalized) && !normalized.startsWith('List of ')
}

/**
 * Collapse the raw result list to one entry per article segment.
 *
 * The index holds several questions per segment, so a single query often
 * returns the same passage repeatedly. Keeps the highest-ranked question for
 * each segment and preserves rank order.
 */
export function dedupeBySegment(results: AskSearchResult[], limit = 6): AskSearchResult[] {
  const seen = new Set<string>()
  const out: AskSearchResult[] = []

  for (const result of [...results].sort((a, b) => b.rank - a.rank)) {
    const key = `${result.language}:${result.title}:${result.segment_id}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(result)
    if (out.length >= limit) break
  }

  return out
}
