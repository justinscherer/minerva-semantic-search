/**
 * Turns a semantic-search hit into a quotable passage.
 *
 * The semantic API returns a `segment_id`, which is the Parsoid element id that
 * anchored the segment when the article was indexed. Those ids are stable for
 * quiet articles but drift on heavily edited ones, so every resolved passage is
 * scored against the matched question and we fall back to the best-scoring
 * paragraph in the article when the anchor has clearly moved.
 */

import { wikiHostFromLang, wikimediaApiFetchHeaders } from '@/config'

/** Blocks that read as a self-contained quote. */
const BLOCK_SELECTOR = 'p, li, dd, blockquote, figcaption, td, th'

/** Chrome that shouldn't appear inside a quote. */
const STRIP_SELECTOR =
  'sup, style, link, .mw-editsection, .mw-ref, .reference, .noprint, .mw-empty-elt, .mbox-text-span'

/** Below this question-overlap score the anchored block is treated as drifted. */
const ANCHOR_SCORE_FLOOR = 0.2

/** Passages longer than this get trimmed to their best-matching sentences. */
const MAX_PASSAGE_CHARS = 420

const MIN_PARAGRAPH_CHARS = 120

const STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'can',
  'did',
  'do',
  'does',
  'for',
  'from',
  'had',
  'has',
  'have',
  'how',
  'in',
  'into',
  'is',
  'it',
  'its',
  'many',
  'much',
  'of',
  'on',
  'or',
  'the',
  'their',
  'them',
  'there',
  'they',
  'this',
  'to',
  'was',
  'were',
  'what',
  'when',
  'where',
  'which',
  'who',
  'why',
  'with',
  'would',
])

export interface ArticleDocument {
  doc: Document
  /** Footnotes in the article, used for the "N references" attribution line. */
  referenceCount: number
}

export interface ResolvedPassage {
  text: string
  /**
   * `true` when the indexed anchor no longer matched its question and the
   * passage came from a whole-article search instead.
   */
  approximate: boolean
}

const documentCache = new Map<string, Promise<ArticleDocument>>()

function articleHtmlUrl(host: string, title: string): string {
  const encoded = encodeURIComponent(title.trim().replace(/ /g, '_'))
  return `https://${host}/api/rest_v1/page/html/${encoded}`
}

/** Parsoid HTML for an article, parsed once and cached per host+title. */
export function fetchArticleDocument(
  title: string,
  options: { lang?: string; signal?: AbortSignal } = {},
): Promise<ArticleDocument> {
  const host = wikiHostFromLang(options.lang ?? 'en')
  const key = `${host}:${title}`

  const cached = documentCache.get(key)
  if (cached) return cached

  const pending = (async (): Promise<ArticleDocument> => {
    const response = await fetch(articleHtmlUrl(host, title), {
      signal: options.signal,
      headers: wikimediaApiFetchHeaders('semantic-search-passage'),
    })

    if (!response.ok) {
      throw new Error(`Could not load ${title} (HTTP ${response.status})`)
    }

    const html = await response.text()
    const doc = new DOMParser().parseFromString(html, 'text/html')

    return {
      doc,
      referenceCount: doc.querySelectorAll('li[id^="cite_note"]').length,
    }
  })()

  // Don't poison the cache with a transient network failure.
  pending.catch(() => documentCache.delete(key))
  documentCache.set(key, pending)

  return pending
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token))
}

/** Share of the question's content words that appear in the candidate text. */
function overlapScore(candidate: string, question: string): number {
  const questionTokens = new Set(tokenize(question))
  if (!questionTokens.size) return 0

  const candidateTokens = new Set(tokenize(candidate))
  let hits = 0
  for (const token of questionTokens) {
    if (candidateTokens.has(token)) hits += 1
  }

  return hits / questionTokens.size
}

function cleanText(element: Element): string {
  const clone = element.cloneNode(true) as Element
  clone.querySelectorAll(STRIP_SELECTOR).forEach((node) => node.remove())

  return (clone.textContent ?? '')
    .replace(/\[\d+]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function splitSentences(text: string): string[] {
  const parts = text.match(/[^.!?]+[.!?]*\s*/g)
  return parts?.map((part) => part.trim()).filter(Boolean) ?? [text]
}

/**
 * Trim an over-long passage to the run of sentences that best answers the
 * question, so a card shows the relevant lines rather than a whole paragraph.
 */
function bestSentenceWindow(text: string, question: string): string {
  if (text.length <= MAX_PASSAGE_CHARS) return text

  const sentences = splitSentences(text)
  let best = { score: -1, text: sentences[0] ?? text }

  for (let start = 0; start < sentences.length; start += 1) {
    let window = ''
    for (let end = start; end < sentences.length; end += 1) {
      const next = window.length ? `${window} ${sentences[end]}` : sentences[end]
      if (next.length > MAX_PASSAGE_CHARS && window.length) break
      window = next

      const score = overlapScore(window, question)
      if (score > best.score) {
        best = { score, text: window }
      }
      if (window.length > MAX_PASSAGE_CHARS) break
    }
  }

  return best.text.slice(0, MAX_PASSAGE_CHARS + 40)
}

function anchoredBlock(doc: Document, segmentId: string): Element | null {
  const anchor = doc.getElementById(segmentId)
  if (!anchor) return null

  if (anchor.matches(BLOCK_SELECTOR)) return anchor
  return anchor.closest(BLOCK_SELECTOR) ?? anchor.closest('section')
}

function bestParagraph(
  doc: Document,
  question: string,
): { element: Element; score: number } | null {
  let best: { element: Element; score: number } | null = null

  for (const paragraph of Array.from(doc.querySelectorAll('p'))) {
    const text = cleanText(paragraph)
    if (text.length < MIN_PARAGRAPH_CHARS) continue

    const score = overlapScore(text, question)
    if (!best || score > best.score) {
      best = { element: paragraph, score }
    }
  }

  return best
}

/**
 * Passage for one search hit: the indexed segment when its anchor still lines
 * up with the question, otherwise the closest paragraph in the live article.
 */
export function resolvePassage(
  article: ArticleDocument,
  segmentId: string,
  question: string,
): ResolvedPassage | null {
  const anchored = anchoredBlock(article.doc, segmentId)
  const anchoredText = anchored ? cleanText(anchored) : ''
  const anchoredScore = anchoredText ? overlapScore(anchoredText, question) : 0

  if (anchoredText.length >= MIN_PARAGRAPH_CHARS && anchoredScore >= ANCHOR_SCORE_FLOOR) {
    return { text: bestSentenceWindow(anchoredText, question), approximate: false }
  }

  const fallback = bestParagraph(article.doc, question)
  if (fallback && fallback.score > anchoredScore) {
    return {
      text: bestSentenceWindow(cleanText(fallback.element), question),
      approximate: true,
    }
  }

  if (!anchoredText.length) return null

  return { text: bestSentenceWindow(anchoredText, question), approximate: true }
}
