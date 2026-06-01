import type { PMNode, PMMark } from './mark-scanning'

const MARK_NAME = 'hiveSuggestion'
const ATTR_KEY = 'suggestionId'

/**
 * Locate a `hiveSuggestion` mark with the target id and replace its marked text
 * range with `replacementText`. Returns the new doc + a flag indicating whether
 * the mark was found (orphaned suggestions return { doc: input, found: false }).
 *
 * Strategy: walk each block's `content` array. When we hit the first text node
 * carrying the target `hiveSuggestion` mark, identify the contiguous run of
 * sibling text nodes (within the same block) that ALSO carry the mark with the
 * same id. Replace that whole run with a single new text node containing
 * `replacementText`. The replacement preserves the non-`hiveSuggestion` sibling
 * marks (bold / italic / etc.) from the FIRST removed text node — sibling marks
 * that varied across the run are dropped (user accepted the inserted text
 * wholesale; we can't infer their formatting intent).
 *
 * Operates on the mark's CURRENT range in the doc; the function does NOT take
 * an external `selection_start` offset. So upstream edits that shifted the
 * prose around the mark don't matter — as long as the mark still exists, the
 * replacement lands at its current position.
 *
 * Multi-block: if the same suggestion id appears as marks in TWO different
 * block elements (rare — would mean a mark survived a block split), only the
 * first block's run is replaced. Subsequent blocks are left untouched.
 *
 * Input is treated as immutable; the function returns a new doc with the
 * affected branch deep-cloned along the path of the edit.
 */
export function applySuggestionToDoc(
  doc: PMNode,
  suggestionId: string,
  replacementText: string,
): { doc: PMNode; found: boolean } {
  const result = visitBlock(doc, suggestionId, replacementText)
  if (!result.found) return { doc, found: false }
  return { doc: result.node, found: true }
}

function hasTargetMark(node: PMNode, suggestionId: string): boolean {
  if (node.type !== 'text') return false
  const mark = node.marks?.find((m) => m.type === MARK_NAME)
  if (!mark) return false
  return mark.attrs?.[ATTR_KEY] === suggestionId
}

function stripSuggestionMark(marks: PMMark[] | undefined): PMMark[] | undefined {
  if (!marks) return undefined
  const filtered = marks.filter((m) => m.type !== MARK_NAME)
  return filtered.length ? filtered : undefined
}

/**
 * Recursively walks block-level structure looking for the first block whose
 * `content` array contains a run of text nodes carrying the target mark.
 * Once found, rewrites that block's content and stops searching (only the
 * first block is touched).
 */
function visitBlock(
  node: PMNode,
  suggestionId: string,
  replacementText: string,
): { node: PMNode; found: boolean } {
  if (!node.content || node.content.length === 0) {
    return { node, found: false }
  }

  // Does this block contain a text node carrying the mark directly?
  const directHitIdx = node.content.findIndex((child) =>
    hasTargetMark(child, suggestionId),
  )

  if (directHitIdx !== -1) {
    // Find the contiguous run of marked text nodes starting at directHitIdx.
    let endIdx = directHitIdx
    while (
      endIdx + 1 < node.content.length &&
      hasTargetMark(node.content[endIdx + 1]!, suggestionId)
    ) {
      endIdx++
    }

    const firstRemoved = node.content[directHitIdx]!
    const replacement: PMNode = {
      type: 'text',
      text: replacementText,
      marks: stripSuggestionMark(firstRemoved.marks),
    }
    // Drop `marks: undefined` to keep object shape clean.
    if (replacement.marks === undefined) delete replacement.marks

    const newContent = [
      ...node.content.slice(0, directHitIdx),
      replacement,
      ...node.content.slice(endIdx + 1),
    ]
    return {
      node: { ...node, content: newContent },
      found: true,
    }
  }

  // Otherwise, descend into children looking for a deeper block that holds
  // the mark. Only rewrite the first child branch that finds it.
  const newChildren: PMNode[] = []
  let found = false
  for (let i = 0; i < node.content.length; i++) {
    const child = node.content[i]!
    if (found) {
      newChildren.push(child)
      continue
    }
    const sub = visitBlock(child, suggestionId, replacementText)
    if (sub.found) {
      found = true
      newChildren.push(sub.node)
    } else {
      newChildren.push(child)
    }
  }

  if (!found) return { node, found: false }
  return { node: { ...node, content: newChildren }, found: true }
}
