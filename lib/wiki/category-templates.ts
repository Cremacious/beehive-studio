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

// TipTap JSON document fragment — minimal, opens with a heading + a hint line.
function doc(headings: Array<{ h2: string; hint: string }>): unknown {
  return {
    type: 'doc',
    content: headings.flatMap(({ h2, hint }) => [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: h2 }] },
      { type: 'paragraph', content: [{ type: 'text', text: hint }] },
    ]),
  }
}

export type CategoryTemplate = {
  category: WikiCategory
  label: string
  blurb: string
  icon: LucideIcon
  accentColor: string        // CSS variable name (without `var()` wrapper)
  defaultBody: unknown       // TipTap doc JSON
}

export const CATEGORY_TEMPLATES: CategoryTemplate[] = [
  { category: 'CHARACTER',   label: 'Character',   blurb: 'A person — protagonist, antagonist, or supporting.',
    icon: User,          accentColor: '--wiki-character',
    defaultBody: doc([
      { h2: 'Appearance', hint: 'Physical description and notable features.' },
      { h2: 'Personality', hint: 'Temperament, beliefs, fears.' },
      { h2: 'Role in story', hint: 'What they want, what stands in their way.' },
    ]) },
  { category: 'LOCATION',    label: 'Location',    blurb: 'A place — city, region, dungeon, planet.',
    icon: MapPin,        accentColor: '--wiki-location',
    defaultBody: doc([
      { h2: 'Geography', hint: 'Where it sits in the world.' },
      { h2: 'Notable features', hint: 'What makes it visually or culturally distinct.' },
      { h2: 'Inhabitants', hint: 'Who lives here and why it matters.' },
    ]) },
  { category: 'LORE',        label: 'Lore',        blurb: 'A myth, legend, or historical event.',
    icon: ScrollText,    accentColor: '--wiki-lore',
    defaultBody: doc([
      { h2: 'Origin', hint: 'When and where this began.' },
      { h2: 'What is believed', hint: 'The popular version of the story.' },
      { h2: 'Truth', hint: 'What really happened (or what the narrator knows).' },
    ]) },
  { category: 'PLOT',        label: 'Plot thread', blurb: 'A storyline or arc you are tracking.',
    icon: Drama,         accentColor: '--wiki-plot',
    defaultBody: doc([
      { h2: 'Setup', hint: 'How and when this thread enters the story.' },
      { h2: 'Stakes', hint: 'What the protagonist stands to gain or lose.' },
      { h2: 'Payoff', hint: 'Where this thread resolves (or refuses to).' },
    ]) },
  { category: 'ARTIFACT',    label: 'Artifact',    blurb: 'An object — weapon, relic, technology.',
    icon: Sword,         accentColor: '--wiki-artifact',
    defaultBody: doc([
      { h2: 'Description', hint: 'Form, material, sensory presence.' },
      { h2: 'Powers / function', hint: 'What it does.' },
      { h2: 'History', hint: 'Where it came from and who has held it.' },
    ]) },
  { category: 'FACTION',     label: 'Faction',     blurb: 'A group, guild, nation, or organization.',
    icon: Flag,          accentColor: '--wiki-faction',
    defaultBody: doc([
      { h2: 'Mission', hint: 'What they want.' },
      { h2: 'Structure', hint: 'How they are organized; key figures.' },
      { h2: 'Allies & enemies', hint: 'Who they work with and against.' },
    ]) },
  { category: 'CULTURE',     label: 'Culture',     blurb: 'A people or society — customs, beliefs, daily life.',
    icon: Globe,         accentColor: '--wiki-culture',
    defaultBody: doc([
      { h2: 'Values', hint: 'What this culture holds sacred.' },
      { h2: 'Customs', hint: 'Daily rituals and milestones.' },
      { h2: 'Tensions', hint: 'Internal frictions or external pressures.' },
    ]) },
  { category: 'LANGUAGE',    label: 'Language',    blurb: 'A tongue, dialect, or constructed lexicon.',
    icon: Languages,     accentColor: '--wiki-language',
    defaultBody: doc([
      { h2: 'Phonology', hint: 'Sound and feel; how it is heard.' },
      { h2: 'Lexicon', hint: 'A starter list of words and phrases.' },
      { h2: 'Speakers', hint: 'Who uses this language and in what contexts.' },
    ]) },
  { category: 'BIOLOGY',     label: 'Biology / species', blurb: 'A creature, race, or organism.',
    icon: Leaf,          accentColor: '--wiki-biology',
    defaultBody: doc([
      { h2: 'Form', hint: 'Anatomy and lifecycle.' },
      { h2: 'Behavior', hint: 'Social structure, diet, conflict.' },
      { h2: 'Role in story', hint: 'How they intersect with the plot.' },
    ]) },
  { category: 'THEME',       label: 'Theme',       blurb: 'A motif or thematic question your book asks.',
    icon: Sparkles,      accentColor: '--wiki-theme',
    defaultBody: doc([
      { h2: 'The question', hint: 'One sentence framing.' },
      { h2: 'Where it appears', hint: 'Scenes / characters that carry it.' },
      { h2: 'The answer', hint: 'What the book argues, if anything.' },
    ]) },
  { category: 'ECONOMY',     label: 'Economy',     blurb: 'Trade, currency, resources, scarcity.',
    icon: Coins,         accentColor: '--wiki-economy',
    defaultBody: doc([
      { h2: 'Currency', hint: 'What is exchanged and how.' },
      { h2: 'Major trade', hint: 'Who produces what, who needs what.' },
      { h2: 'Friction', hint: 'Scarcities, monopolies, criminal economies.' },
    ]) },
  { category: 'TERMINOLOGY', label: 'Terminology', blurb: 'A glossary entry — slang, jargon, in-world term.',
    icon: BookA,         accentColor: '--wiki-terminology',
    defaultBody: doc([
      { h2: 'Definition', hint: 'Plain-English meaning.' },
      { h2: 'In-world usage', hint: 'Who uses it; example sentence.' },
    ]) },
  { category: 'TIMELINE',    label: 'Timeline',    blurb: 'A chronology — eras, decades, or beats.',
    icon: Clock,         accentColor: '--wiki-timeline',
    defaultBody: doc([
      { h2: 'Era', hint: 'Name and scope of this chunk of time.' },
      { h2: 'Key events', hint: 'Bulleted list of what happened.' },
      { h2: 'How it shapes today', hint: 'Why this matters to the present narrative.' },
    ]) },
  { category: 'OTHER',       label: 'Other',       blurb: "Doesn't fit a category — that's fine.",
    icon: FileQuestion,  accentColor: '--wiki-other',
    defaultBody: doc([
      { h2: 'Notes', hint: 'Anything you need to remember.' },
    ]) },
]

export const CATEGORY_TEMPLATE_MAP: Record<WikiCategory, CategoryTemplate> =
  Object.fromEntries(CATEGORY_TEMPLATES.map(t => [t.category, t])) as Record<WikiCategory, CategoryTemplate>
