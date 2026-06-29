// Generate the app's favicon + icon set from the master brand mark.
//
// Source of truth: public/brand/beehive-logo.svg (the stacked-books beehive mark,
// brand yellow #FFC300 on transparent). The mark is landscape (791x398), so each
// square icon centers it on a transparent square canvas with a small margin.
//
// Run: node scripts/generate-brand-icons.mjs
// Writes: app/icon.png, app/apple-icon.png, app/favicon.ico,
//         public/icon-192.png, public/icon-512.png
//
// favicon.ico is assembled by hand (PNG-compressed entries at 16/32/48) since
// sharp has no .ico encoder. Re-run this whenever the master SVG changes.

import sharp from 'sharp'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const svg = readFileSync(resolve(root, 'public/brand/beehive-logo.svg'))

const ASPECT = 791 / 398 // master viewBox aspect
const MARGIN = 0.92 // fraction of the square the mark's width fills

// Render the mark centered on a transparent SxS canvas.
async function square(size) {
  const innerW = Math.round(size * MARGIN)
  const mark = await sharp(svg, { density: 700 })
    .resize({ width: innerW })
    .png()
    .toBuffer()
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: mark, gravity: 'center' }])
    .png()
    .toBuffer()
}

// Minimal ICO container with PNG-compressed entries (Vista+ / all modern browsers).
function buildIco(images) {
  const count = images.length
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type: icon
  header.writeUInt16LE(count, 4)
  const dir = Buffer.alloc(16 * count)
  let offset = 6 + 16 * count
  images.forEach(({ size, buffer }, i) => {
    const e = i * 16
    dir.writeUInt8(size >= 256 ? 0 : size, e + 0) // width (0 = 256)
    dir.writeUInt8(size >= 256 ? 0 : size, e + 1) // height
    dir.writeUInt8(0, e + 2) // palette
    dir.writeUInt8(0, e + 3) // reserved
    dir.writeUInt16LE(1, e + 4) // color planes
    dir.writeUInt16LE(32, e + 6) // bits per pixel
    dir.writeUInt32LE(buffer.length, e + 8)
    dir.writeUInt32LE(offset, e + 12)
    offset += buffer.length
  })
  return Buffer.concat([header, dir, ...images.map((i) => i.buffer)])
}

async function write(relPath, buffer) {
  const out = resolve(root, relPath)
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, buffer)
  console.log('wrote', relPath, `(${buffer.length} bytes)`)
}

async function main() {
  await write('app/icon.png', await square(512))
  await write('app/apple-icon.png', await square(180))
  await write('public/icon-192.png', await square(192))
  await write('public/icon-512.png', await square(512))

  const ico = buildIco([
    { size: 16, buffer: await square(16) },
    { size: 32, buffer: await square(32) },
    { size: 48, buffer: await square(48) },
  ])
  await write('app/favicon.ico', ico)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
