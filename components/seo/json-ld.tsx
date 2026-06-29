/**
 * Renders a JSON-LD structured-data block (issue #52). Server component.
 *
 * Pass a plain JSON-serializable object (or array) following schema.org
 * vocabulary. The payload is emitted as a <script type="application/ld+json">
 * so crawlers can parse rich-result metadata. Only feed it data that is
 * already public — never private/gated content.
 */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      // JSON.stringify escapes the payload; we additionally neutralize the
      // sequence "</" so a stray value can't break out of the script element.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, '\\u003c'),
      }}
    />
  )
}
