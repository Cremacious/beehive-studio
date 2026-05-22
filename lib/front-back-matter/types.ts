// Sub-type discriminator for front_matter / back_matter binder items.
// Stored at binderItems.content.subtype.

export type FrontMatterSubtype =
  | 'title_page'
  | 'copyright'
  | 'dedication'
  | 'custom'

export type BackMatterSubtype =
  | 'acknowledgments'
  | 'about_author'
  | 'custom'

export type Subtype = FrontMatterSubtype | BackMatterSubtype

// Field shapes per specialized subtype. 'custom' has no fields.

export type TitlePageFields = {
  bookTitle: string
  subtitle?: string
  authorName: string
  publisherName?: string
}

export type CopyrightFields = {
  copyrightYear: number
  copyrightHolder: string
  publisherName?: string
  isbn?: string
  extraNotice?: string
}

export type DedicationFields = {
  text: string
}

export type AcknowledgmentsFields = {
  text: string
}

export type AboutAuthorFields = {
  bio: string
  photoUrl?: string
  links?: Array<{ label: string; url: string }>
}

// Discriminated union for binderItems.content (FM/BM only).
export type FrontBackMatterContent =
  | { subtype: null; fields: Record<string, never> }
  | { subtype: 'title_page'; fields: TitlePageFields }
  | { subtype: 'copyright'; fields: CopyrightFields }
  | { subtype: 'dedication'; fields: DedicationFields }
  | { subtype: 'acknowledgments'; fields: AcknowledgmentsFields }
  | { subtype: 'about_author'; fields: AboutAuthorFields }
  | { subtype: 'custom'; fields: Record<string, never> }

// Picker option descriptors (rendered in the SubtypePicker UI).

export type PickerOption = {
  subtype: Subtype
  label: string
  description: string
}

export const FRONT_MATTER_OPTIONS: PickerOption[] = [
  { subtype: 'title_page', label: 'Title Page', description: 'Book title, author, publisher' },
  { subtype: 'copyright',  label: 'Copyright',  description: 'Copyright year, publisher, ISBN' },
  { subtype: 'dedication', label: 'Dedication', description: '"For my wife"' },
  { subtype: 'custom',     label: 'Custom',     description: 'Free-form prose' },
]

export const BACK_MATTER_OPTIONS: PickerOption[] = [
  { subtype: 'acknowledgments', label: 'Acknowledgments',  description: 'Thank-you to people who helped' },
  { subtype: 'about_author',    label: 'About the Author', description: 'Bio, photo, links' },
  { subtype: 'custom',          label: 'Custom',           description: 'Free-form prose' },
]
