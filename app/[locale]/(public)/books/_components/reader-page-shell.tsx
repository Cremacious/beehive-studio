'use client'

import { useState } from 'react'
import { BookHero } from './book-hero'
import { ChaptersPanel } from './chapters-panel'
import type { ComponentProps } from 'react'

type HeroProps = Omit<ComponentProps<typeof BookHero>, 'readCount'>
type ChaptersProps = Omit<ComponentProps<typeof ChaptersPanel>, 'onReadSetChange'>

type Props = {
  hero: HeroProps
  chapters: ChaptersProps
  children: React.ReactNode
}

export function ReaderPageShell({ hero, chapters, children }: Props) {
  const [readSet, setReadSet] = useState<Set<string>>(() => new Set(chapters.initialReadSet))
  const readCount = chapters.chapters.filter((c) => readSet.has(c.binderItemId)).length

  return (
    <>
      <BookHero {...hero} readCount={readCount} />
      <ChaptersPanel {...chapters} onReadSetChange={setReadSet} />
      {children}
    </>
  )
}
