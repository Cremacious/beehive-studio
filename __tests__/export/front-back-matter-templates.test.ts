import { describe, expect, it } from 'vitest'
import {
  renderTitlePage,
  renderCopyright,
  renderDedication,
  renderAcknowledgments,
  renderAboutAuthor,
} from '@/lib/export/front-back-matter-templates'

describe('renderTitlePage', () => {
  it('produces centered HTML with title and author', () => {
    const html = renderTitlePage({
      bookTitle: 'The Sun Also Rises',
      authorName: 'Ernest Hemingway',
    })
    expect(html).toContain('The Sun Also Rises')
    expect(html).toContain('Ernest Hemingway')
    expect(html.toLowerCase()).toContain('text-align')
  })

  it('includes subtitle and publisher when provided', () => {
    const html = renderTitlePage({
      bookTitle: 'Book',
      subtitle: 'A Tale',
      authorName: 'Author',
      publisherName: 'Pub',
    })
    expect(html).toContain('A Tale')
    expect(html).toContain('Pub')
  })

  it('escapes HTML special chars in fields', () => {
    const html = renderTitlePage({ bookTitle: '<script>', authorName: 'A&B' })
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('A&amp;B')
  })
})

describe('renderCopyright', () => {
  it('includes copyright year and holder', () => {
    const html = renderCopyright({
      copyrightYear: 2026,
      copyrightHolder: 'Jane Doe',
    })
    expect(html).toContain('2026')
    expect(html).toContain('Jane Doe')
    expect(html).toContain('©')
  })

  it('includes ISBN when provided', () => {
    const html = renderCopyright({
      copyrightYear: 2026,
      copyrightHolder: 'X',
      isbn: '978-0-13-468599-1',
    })
    expect(html).toContain('978-0-13-468599-1')
  })

  it('defaults to "All rights reserved" when no extraNotice', () => {
    const html = renderCopyright({ copyrightYear: 2026, copyrightHolder: 'X' })
    expect(html.toLowerCase()).toContain('all rights reserved')
  })

  it('uses extraNotice paragraphs when provided', () => {
    const html = renderCopyright({
      copyrightYear: 2026,
      copyrightHolder: 'X',
      extraNotice: 'No part of this book may be reproduced.\n\nPrinted in Canada.',
    })
    expect(html).toContain('No part of this book')
    expect(html).toContain('Printed in Canada.')
    expect(html.match(/<p[^>]*>/g)?.length ?? 0).toBeGreaterThanOrEqual(2)
  })
})

describe('renderDedication', () => {
  it('renders dedication text in italic', () => {
    const html = renderDedication({ text: 'For my wife.' })
    expect(html).toContain('For my wife.')
    expect(html.toLowerCase()).toMatch(/italic|<em>/)
  })

  it('preserves paragraph breaks', () => {
    const html = renderDedication({ text: 'Line 1\n\nLine 2' })
    expect((html.match(/<p[^>]*>/g) ?? []).length).toBeGreaterThanOrEqual(2)
  })
})

describe('renderAcknowledgments', () => {
  it('renders the heading + paragraphs', () => {
    const html = renderAcknowledgments({ text: 'Thanks to my editor.' })
    expect(html.toLowerCase()).toContain('acknowledgments')
    expect(html).toContain('Thanks to my editor.')
  })

  it('preserves multi-paragraph text', () => {
    const html = renderAcknowledgments({ text: 'Para 1.\n\nPara 2.' })
    expect((html.match(/<p[^>]*>/g) ?? []).length).toBeGreaterThanOrEqual(2)
  })
})

describe('renderAboutAuthor', () => {
  it('includes bio text', () => {
    const html = renderAboutAuthor({ bio: 'An author of many books.' })
    expect(html).toContain('An author of many books.')
    expect(html.toLowerCase()).toContain('about the author')
  })

  it('includes photo when provided', () => {
    const html = renderAboutAuthor({
      bio: 'b',
      photoUrl: 'https://example.com/p.jpg',
    })
    expect(html).toContain('https://example.com/p.jpg')
    expect(html).toContain('<img')
  })

  it('renders links as a list', () => {
    const html = renderAboutAuthor({
      bio: 'b',
      links: [{ label: 'Website', url: 'https://a.com' }],
    })
    expect(html).toContain('Website')
    expect(html).toContain('https://a.com')
    expect(html).toContain('<ul')
  })

  it('omits photo section when photoUrl absent', () => {
    const html = renderAboutAuthor({ bio: 'b' })
    expect(html).not.toContain('<img')
  })

  it('omits links section when links empty', () => {
    const html = renderAboutAuthor({ bio: 'b', links: [] })
    expect(html).not.toContain('<ul')
  })
})
