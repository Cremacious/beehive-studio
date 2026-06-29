// Generate the default social share image (Open Graph / Twitter) from the
// brand mark. Issue #52.
//
// Source of truth: public/brand/beehive-logo.svg (the stacked-books beehive
// mark, brand yellow #FFC300 on transparent). The output is a 1200x630 card on
// the app's dark shell color (#262728) with the mark + "Beehive Books" wordmark
// + slogan, which is what link unfurlers (X, Slack, iMessage, Facebook) request
// when a page has no entity-specific cover/avatar.
//
// Run: node scripts/generate-og-image.mjs
// Writes: public/og-default.png
//
// Re-run this whenever the master SVG or brand color changes.

import sharp from 'sharp'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const logoSvg = readFileSync(resolve(root, 'public/brand/beehive-logo.svg'))

const W = 1200
const H = 630
const BG = '#262728'
const BRAND = '#FFC300'
const INK = '#F4F1EC'
const INK_MUTED = '#A8A29B'

const LOGO_W = 360
const LOGO_H = Math.round((398 / 791) * LOGO_W) // preserve master aspect
const LOGO_TOP = 150
const LOGO_LEFT = Math.round((W - LOGO_W) / 2)

const FONT_STACK = 'Comfortaa, Trebuchet MS, Segoe UI, Verdana, sans-serif'

// Background card: dark fill + a faint brand-tinted radial glow + a subtle dot
// grid, matching the app's reader/landing texture.
const backgroundSvg = `
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="glow" cx="50%" cy="28%" r="70%">
      <stop offset="0%" stop-color="${BRAND}" stop-opacity="0.10" />
      <stop offset="60%" stop-color="${BRAND}" stop-opacity="0" />
    </radialGradient>
    <pattern id="dots" width="26" height="26" patternUnits="userSpaceOnUse">
      <circle cx="1" cy="1" r="1" fill="#FFFFFF" fill-opacity="0.025" />
    </pattern>
  </defs>
  <rect width="${W}" height="${H}" fill="${BG}" />
  <rect width="${W}" height="${H}" fill="url(#dots)" />
  <rect width="${W}" height="${H}" fill="url(#glow)" />
</svg>`

// Wordmark + slogan, centered under the logo.
const textSvg = `
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <text x="${W / 2}" y="430" text-anchor="middle"
    font-family="${FONT_STACK}" font-size="72" font-weight="700"
    fill="${INK}">Beehive Books</text>
  <text x="${W / 2}" y="500" text-anchor="middle"
    font-family="${FONT_STACK}" font-size="32" font-weight="500"
    fill="${BRAND}">Get buzzed about writing!</text>
  <text x="${W / 2}" y="560" text-anchor="middle"
    font-family="${FONT_STACK}" font-size="22" font-weight="400"
    fill="${INK_MUTED}">Write. Collaborate. Publish to a community of readers.</text>
</svg>`

async function main() {
  const logoPng = await sharp(logoSvg, { density: 700 })
    .resize({ width: LOGO_W, height: LOGO_H, fit: 'contain' })
    .png()
    .toBuffer()

  const out = await sharp(Buffer.from(backgroundSvg))
    .composite([
      { input: logoPng, top: LOGO_TOP, left: LOGO_LEFT },
      { input: Buffer.from(textSvg), top: 0, left: 0 },
    ])
    .png()
    .toBuffer()

  const dest = resolve(root, 'public/og-default.png')
  writeFileSync(dest, out)
  const meta = await sharp(out).metadata()
  console.log(`Wrote ${dest} (${meta.width}x${meta.height}, ${out.length} bytes)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
