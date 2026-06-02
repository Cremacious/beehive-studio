import {
  User, MapPin, ScrollText, Drama, Sword,
  Flag, Globe, Languages, Leaf, Sparkles,
  Coins, BookA, Clock, FileQuestion,
  type LucideIcon,
} from 'lucide-react'

export type WikiCategory =
  | 'CHARACTER' | 'LOCATION' | 'LORE' | 'PLOT' | 'ARTIFACT'
  | 'FACTION' | 'CULTURE' | 'LANGUAGE' | 'BIOLOGY' | 'THEME'
  | 'ECONOMY' | 'TERMINOLOGY' | 'TIMELINE' | 'OTHER'

type SectionSeed = { label: string; hint: string }

// Legacy: TipTap doc fragment — opens with H2 + hint paragraph for each section.
// Preserved on the type for back-compat with code outside the wiki editor that
// might still read it. The new sections-shape consumes the same seed list
// directly via defaultSections.
function legacyBody(sections: SectionSeed[]): unknown {
  return {
    type: 'doc',
    content: sections.flatMap(({ label, hint }) => [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: label }] },
      { type: 'paragraph', content: [{ type: 'text', text: hint }] },
    ]),
  }
}

export type CategoryTemplate = {
  category: WikiCategory
  label: string
  blurb: string
  icon: LucideIcon
  accentColor: string                 // CSS variable name (without `var()` wrapper)
  defaultBody: unknown                // Legacy TipTap doc JSON (back-compat)
  defaultSections: SectionSeed[]      // New shape — labels + per-section placeholder hints
}

function template(
  category: WikiCategory,
  label: string,
  blurb: string,
  icon: LucideIcon,
  accentColor: string,
  sections: SectionSeed[],
): CategoryTemplate {
  return {
    category, label, blurb, icon, accentColor,
    defaultSections: sections,
    defaultBody: legacyBody(sections),
  }
}

export const CATEGORY_TEMPLATES: CategoryTemplate[] = [
  template('CHARACTER',   'Character',         'A person — protagonist, antagonist, or supporting.', User,         '--wiki-character', [
    { label: 'Appearance',   hint: 'Physical description and notable features.' },
    { label: 'Personality',  hint: 'Temperament, beliefs, fears.' },
    { label: 'Role in story', hint: 'What they want, what stands in their way.' },
  ]),
  template('LOCATION',    'Location',          'A place — city, region, dungeon, planet.', MapPin,         '--wiki-location', [
    { label: 'Geography',         hint: 'Where it sits in the world.' },
    { label: 'Notable features',  hint: 'What makes it visually or culturally distinct.' },
    { label: 'Inhabitants',       hint: 'Who lives here and why it matters.' },
  ]),
  template('LORE',        'Lore',              'A myth, legend, or historical event.', ScrollText,    '--wiki-lore', [
    { label: 'Origin',           hint: 'When and where this began.' },
    { label: 'What is believed', hint: 'The popular version of the story.' },
    { label: 'Truth',            hint: 'What really happened (or what the narrator knows).' },
  ]),
  template('PLOT',        'Plot thread',       'A storyline or arc you are tracking.', Drama,         '--wiki-plot', [
    { label: 'Setup',  hint: 'How and when this thread enters the story.' },
    { label: 'Stakes', hint: 'What the protagonist stands to gain or lose.' },
    { label: 'Payoff', hint: 'Where this thread resolves (or refuses to).' },
  ]),
  template('ARTIFACT',    'Artifact',          'An object — weapon, relic, technology.', Sword,         '--wiki-artifact', [
    { label: 'Description',       hint: 'Form, material, sensory presence.' },
    { label: 'Powers / function', hint: 'What it does.' },
    { label: 'History',           hint: 'Where it came from and who has held it.' },
  ]),
  template('FACTION',     'Faction',           'A group, guild, nation, or organization.', Flag,          '--wiki-faction', [
    { label: 'Mission',          hint: 'What they want.' },
    { label: 'Structure',        hint: 'How they are organized; key figures.' },
    { label: 'Allies & enemies', hint: 'Who they work with and against.' },
  ]),
  template('CULTURE',     'Culture',           'A people or society — customs, beliefs, daily life.', Globe,         '--wiki-culture', [
    { label: 'Values',   hint: 'What this culture holds sacred.' },
    { label: 'Customs',  hint: 'Daily rituals and milestones.' },
    { label: 'Tensions', hint: 'Internal frictions or external pressures.' },
  ]),
  template('LANGUAGE',    'Language',          'A tongue, dialect, or constructed lexicon.', Languages,     '--wiki-language', [
    { label: 'Phonology', hint: 'Sound and feel; how it is heard.' },
    { label: 'Lexicon',   hint: 'A starter list of words and phrases.' },
    { label: 'Speakers',  hint: 'Who uses this language and in what contexts.' },
  ]),
  template('BIOLOGY',     'Biology / species', 'A creature, race, or organism.', Leaf,          '--wiki-biology', [
    { label: 'Form',           hint: 'Anatomy and lifecycle.' },
    { label: 'Behavior',       hint: 'Social structure, diet, conflict.' },
    { label: 'Role in story',  hint: 'How they intersect with the plot.' },
  ]),
  template('THEME',       'Theme',             'A motif or thematic question your book asks.', Sparkles,      '--wiki-theme', [
    { label: 'The question',     hint: 'One sentence framing.' },
    { label: 'Where it appears', hint: 'Scenes / characters that carry it.' },
    { label: 'The answer',       hint: 'What the book argues, if anything.' },
  ]),
  template('ECONOMY',     'Economy',           'Trade, currency, resources, scarcity.', Coins,         '--wiki-economy', [
    { label: 'Currency',    hint: 'What is exchanged and how.' },
    { label: 'Major trade', hint: 'Who produces what, who needs what.' },
    { label: 'Friction',    hint: 'Scarcities, monopolies, criminal economies.' },
  ]),
  template('TERMINOLOGY', 'Terminology',       'A glossary entry — slang, jargon, in-world term.', BookA,         '--wiki-terminology', [
    { label: 'Definition',     hint: 'Plain-English meaning.' },
    { label: 'In-world usage', hint: 'Who uses it; example sentence.' },
  ]),
  template('TIMELINE',    'Timeline',          'A chronology — eras, decades, or beats.', Clock,         '--wiki-timeline', [
    { label: 'Era',                  hint: 'Name and scope of this chunk of time.' },
    { label: 'Key events',           hint: 'Bulleted list of what happened.' },
    { label: 'How it shapes today',  hint: 'Why this matters to the present narrative.' },
  ]),
  template('OTHER',       'Other',             "Doesn't fit a category — that's fine.", FileQuestion,  '--wiki-other', [
    { label: 'Notes', hint: 'Anything you need to remember.' },
  ]),
]

export const CATEGORY_TEMPLATE_MAP: Record<WikiCategory, CategoryTemplate> =
  Object.fromEntries(CATEGORY_TEMPLATES.map(t => [t.category, t])) as Record<WikiCategory, CategoryTemplate>
