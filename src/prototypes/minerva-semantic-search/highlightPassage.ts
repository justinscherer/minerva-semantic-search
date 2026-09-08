/**
 * Finds a quoted passage inside a rendered article and marks it up, so tapping
 * a semantic result lands the reader on the sentences the answer came from.
 *
 * Matching runs against a cleaned copy of the article text — reference markers
 * and edit chrome removed, whitespace collapsed — which is the same shape the
 * passage was extracted in (see `passages.ts`). Every cleaned character keeps a
 * pointer back to its text node, so a match can be wrapped in place without
 * touching the surrounding markup.
 */

/** Not part of the prose: reference markers, edit links, hidden chrome. */
const SKIP_SELECTOR = 'sup, style, .mw-editsection, .mw-ref, .reference, .noprint, .mw-empty-elt'

/** Blocks a passage can live in. */
const BLOCK_SELECTOR = 'p, li, dd, blockquote, td, th, figcaption'

export const HIGHLIGHT_CLASS = 'mss-passage-highlight'

/** Give up on an exact match below this share of shared words. */
const MIN_BLOCK_SCORE = 0.3

interface CharPointer {
  node: Text
  offset: number
}

interface CleanedBlock {
  text: string
  pointers: CharPointer[]
}

function normalizeQuery(value: string): string {
  return value
    .replace(/\[\d+]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Cleaned text of a block plus a pointer per character. Whitespace runs
 * collapse to a single space and skipped subtrees contribute nothing, matching
 * how passages were extracted.
 */
function cleanBlock(block: Element): CleanedBlock {
  const walker = block.ownerDocument.createTreeWalker(block, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = (node as Text).parentElement
      if (!parent) return NodeFilter.FILTER_REJECT
      // `closest` is bounded by the block: chrome outside it can't reach here.
      if (parent.closest(SKIP_SELECTOR)) return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    },
  })

  let text = ''
  const pointers: CharPointer[] = []

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const textNode = node as Text
    const raw = textNode.data

    for (let offset = 0; offset < raw.length; offset += 1) {
      const char = raw[offset]

      if (/\s/.test(char)) {
        if (!text.length || text.endsWith(' ')) continue
        text += ' '
        pointers.push({ node: textNode, offset })
        continue
      }

      text += char
      pointers.push({ node: textNode, offset })
    }
  }

  return stripBracketedNumbers({ text, pointers })
}

/** Drops leftover `[12]` reference markers from the cleaned text and its map. */
function stripBracketedNumbers(block: CleanedBlock): CleanedBlock {
  if (!/\[\d+]/.test(block.text)) return block

  let text = ''
  const pointers: CharPointer[] = []
  const removed = new Set<number>()

  for (const match of block.text.matchAll(/\[\d+]/g)) {
    const start = match.index ?? 0
    for (let index = start; index < start + match[0].length; index += 1) {
      removed.add(index)
    }
  }

  for (let index = 0; index < block.text.length; index += 1) {
    if (removed.has(index)) continue
    text += block.text[index]
    pointers.push(block.pointers[index])
  }

  return { text, pointers }
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2)
}

function overlapScore(candidate: string, passage: string): number {
  const wanted = new Set(tokenize(passage))
  if (!wanted.size) return 0

  const found = new Set(tokenize(candidate))
  let hits = 0
  for (const token of wanted) {
    if (found.has(token)) hits += 1
  }

  return hits / wanted.size
}

/** Character range of `needle` in `haystack`, ignoring case and punctuation drift. */
function findRange(haystack: string, needle: string): { start: number; end: number } | null {
  const direct = haystack.indexOf(needle)
  if (direct >= 0) return { start: direct, end: direct + needle.length }

  const loose = haystack.toLowerCase().indexOf(needle.toLowerCase())
  if (loose >= 0) return { start: loose, end: loose + needle.length }

  // Curly vs straight quotes and dashes differ between extraction and render.
  const fold = (value: string) =>
    value
      .toLowerCase()
      .replace(/[‘’‚‛′]/g, "'")
      .replace(/[“”„‟″]/g, '"')
      .replace(/[‐-―−]/g, '-')

  const folded = fold(haystack).indexOf(fold(needle))
  if (folded >= 0) return { start: folded, end: folded + needle.length }

  return null
}

/** Wrap one cleaned-text range in `<mark>` elements, one per text node touched. */
function markRange(block: CleanedBlock, start: number, end: number): HTMLElement[] {
  const runs: { node: Text; start: number; end: number }[] = []

  for (let index = start; index < end && index < block.pointers.length; index += 1) {
    const pointer = block.pointers[index]
    if (!pointer) continue

    const current = runs[runs.length - 1]
    if (current && current.node === pointer.node) {
      current.end = pointer.offset + 1
      continue
    }

    runs.push({ node: pointer.node, start: pointer.offset, end: pointer.offset + 1 })
  }

  const marks: HTMLElement[] = []

  // Later runs first: wrapping splits text nodes, which would shift earlier
  // offsets if they shared a node.
  for (const run of runs.reverse()) {
    const doc = run.node.ownerDocument
    if (!doc) continue

    const range = doc.createRange()
    range.setStart(run.node, run.start)
    range.setEnd(run.node, Math.min(run.end, run.node.data.length))

    const mark = doc.createElement('mark')
    mark.className = HIGHLIGHT_CLASS
    try {
      range.surroundContents(mark)
      marks.unshift(mark)
    } catch {
      // Range crossed element boundaries — skip this run rather than mangle it.
    }
  }

  return marks
}

/** Remove highlights added by a previous match, restoring the original text. */
export function clearPassageHighlight(root: ParentNode): void {
  for (const mark of Array.from(root.querySelectorAll(`mark.${HIGHLIGHT_CLASS}`))) {
    const parent = mark.parentNode
    if (!parent) continue

    while (mark.firstChild) {
      parent.insertBefore(mark.firstChild, mark)
    }
    parent.removeChild(mark)
    parent.normalize()
  }
}

/**
 * Highlight `passage` inside `root` and return the first mark, or the block it
 * fell back to. `null` when the passage isn't in this article at all.
 */
export function highlightPassage(root: ParentNode, passage: string): HTMLElement | null {
  const needle = normalizeQuery(passage)
  if (needle.length < 20) return null

  clearPassageHighlight(root)

  const blocks = Array.from(root.querySelectorAll(BLOCK_SELECTOR))
  let bestBlock: { block: Element; score: number } | null = null

  for (const block of blocks) {
    // Skip wrappers: the innermost block holding the text is the one to mark.
    if (block.querySelector(BLOCK_SELECTOR)) continue

    const cleaned = cleanBlock(block)
    if (cleaned.text.length < 20) continue

    const range = findRange(cleaned.text, needle)
    if (range) {
      const marks = markRange(cleaned, range.start, range.end)
      if (marks.length) return marks[0]
    }

    const score = overlapScore(cleaned.text, needle)
    if (!bestBlock || score > bestBlock.score) {
      bestBlock = { block, score }
    }
  }

  // The passage may have been trimmed mid-paragraph or the article edited since
  // indexing — mark its first sentence, then the closest paragraph.
  const firstSentence = needle.split(/(?<=[.!?])\s/)[0]
  if (firstSentence && firstSentence.length >= 40 && firstSentence !== needle) {
    const sentenceMatch = highlightPassage(root, firstSentence)
    if (sentenceMatch) return sentenceMatch
  }

  if (bestBlock && bestBlock.score >= MIN_BLOCK_SCORE) {
    const cleaned = cleanBlock(bestBlock.block)
    const marks = markRange(cleaned, 0, cleaned.pointers.length)
    if (marks.length) return marks[0]
    return bestBlock.block as HTMLElement
  }

  return null
}
