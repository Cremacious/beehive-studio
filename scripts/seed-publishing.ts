import { db } from '../db'
import { exportPresets, bookTemplates } from '../db/schema'

async function seed() {
  await db.insert(exportPresets).values([
    {
      name: 'Standard Manuscript Format',
      format: 'DOCX',
      config: {
        font: 'Times New Roman',
        fontSize: 12,
        lineSpacing: 2,
        margins: { top: 1, bottom: 1, left: 1, right: 1 },
        headerFormat: 'AUTHOR_LAST / TITLE_SHORT / PAGE',
        indent: 0.5,
      },
      isSystemPreset: true,
    },
    {
      name: 'EPUB',
      format: 'EPUB',
      config: { includeTableOfContents: true, includeCover: true },
      isSystemPreset: true,
    },
    {
      name: 'KDP Print-Ready PDF',
      format: 'PDF',
      config: { trimSize: '6x9', margins: { top: 0.875, bottom: 0.875, inside: 0.875, outside: 0.625 }, bleed: false },
      isSystemPreset: true,
    },
    {
      name: 'IngramSpark PDF',
      format: 'PDF',
      config: { trimSize: '6x9', margins: { top: 0.875, bottom: 0.875, inside: 0.875, outside: 0.625 }, bleed: true, bleedSize: 0.125 },
      isSystemPreset: true,
    },
    {
      name: 'DOCX',
      format: 'DOCX',
      config: { font: 'Calibri', fontSize: 11, lineSpacing: 1.15 },
      isSystemPreset: true,
    },
  ]).onConflictDoNothing()

  await db.insert(bookTemplates).values([
    {
      name: 'Blank',
      genre: null,
      structure: { parts: [], researchFolders: ['Characters', 'World Notes', 'Outline'] },
      isSystemTemplate: true,
    },
    {
      name: 'Three-Act Thriller',
      genre: 'Thriller',
      structure: {
        parts: [
          { title: 'Act 1 — Setup', chapterCount: 5 },
          { title: 'Act 2 — Confrontation', chapterCount: 12 },
          { title: 'Act 3 — Resolution', chapterCount: 5 },
        ],
        researchFolders: ['Characters', 'Timeline', 'Locations', 'Clues & Twists'],
      },
      isSystemTemplate: true,
    },
    {
      name: 'Romance Arc',
      genre: 'Romance',
      structure: {
        parts: [
          { title: 'Meeting', chapterCount: 4 },
          { title: 'Falling', chapterCount: 8 },
          { title: 'Conflict', chapterCount: 6 },
          { title: 'Resolution (HEA)', chapterCount: 4 },
        ],
        researchFolders: ['Characters', 'Relationship Timeline', 'Settings'],
      },
      isSystemTemplate: true,
    },
    {
      name: 'Fantasy World',
      genre: 'Fantasy',
      structure: {
        parts: [{ title: 'Book One', chapterCount: 10 }],
        researchFolders: ['Characters', 'World Map', 'Magic System', 'Factions', 'History & Lore', 'Outline'],
      },
      isSystemTemplate: true,
    },
  ]).onConflictDoNothing()

  console.log('✅ Seed complete')
  process.exit(0)
}

seed().catch((err) => { console.error(err); process.exit(1) })
