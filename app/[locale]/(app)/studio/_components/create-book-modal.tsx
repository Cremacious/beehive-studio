'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { CreateBookWizard } from './create-book-wizard'
import type { BookTemplate } from './create-book-wizard/step-three'

type Props = {
  locale: string
  templates: BookTemplate[]
  children: React.ReactNode
}

export function CreateBookModal({ locale, templates, children }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <div onClick={() => setOpen(true)} className="contents">
        {children}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl w-full bg-card border-border p-0 overflow-y-auto max-h-[90vh]">
          <DialogHeader className="sr-only">
            <DialogTitle>Create a new book</DialogTitle>
          </DialogHeader>
          <CreateBookWizard
            locale={locale}
            templates={templates}
            onClose={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
