/**
 * Snapshot normalization helpers
 * Keeps content stable across OS by normalizing newlines and trimming
 * trailing spaces. Designed to be a no-op for already-normalized strings.
 */

/** Normalize a single text block */
export function normalizeText(input: string): string {
  // Convert CRLF/CR to LF
  const s = input.replace(/\r\n?/g, '\n')
  // Trim trailing spaces per line
  const lines = s.split('\n')
  for (let i = 0; i < lines.length; i++) {
    lines[i] = lines[i].replace(/[\t ]+$/g, '')
  }
  return lines.join('\n')
}

/** Normalize all values inside a Map<string, string> */
export function normalizeSnapshotMap(
  map: Map<string, string>,
): Map<string, string> {
  const out = new Map<string, string>()
  map.forEach((value, key) => {
    out.set(key, normalizeText(value))
  })
  return out
}
