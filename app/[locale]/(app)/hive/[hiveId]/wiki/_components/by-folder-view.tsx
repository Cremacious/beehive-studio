'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Folder } from 'lucide-react'
import type { HiveWikiEntry, HiveWikiFolder } from '@/lib/actions/hive-content.actions'
import { EntryCard } from './entry-card'

export function ByFolderView({
  entries,
  folders,
  onOpenEntry,
}: {
  entries: HiveWikiEntry[]
  folders: HiveWikiFolder[]
  onOpenEntry: (id: string) => void
}) {
  const rootFolders = folders.filter(f => f.parentId === null)
  const rootEntries = entries.filter(e => e.parentId === null)

  return (
    <div className="space-y-6">
      {rootFolders.map(f => (
        <FolderNode
          key={f.id}
          folder={f}
          entries={entries}
          folders={folders}
          depth={0}
          onOpenEntry={onOpenEntry}
        />
      ))}
      {rootEntries.length > 0 && (
        <section>
          <div className="text-xs uppercase tracking-wide text-muted-foreground py-2">
            Top level ({rootEntries.length})
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rootEntries.map(e => (
              <EntryCard key={e.id} entry={e} onClick={() => onOpenEntry(e.id)} />
            ))}
          </div>
        </section>
      )}
      {rootFolders.length === 0 && rootEntries.length === 0 && (
        <div className="text-center text-sm text-muted-foreground py-12">
          No wiki content yet.
        </div>
      )}
    </div>
  )
}

function FolderNode({
  folder,
  entries,
  folders,
  depth,
  onOpenEntry,
}: {
  folder: HiveWikiFolder
  entries: HiveWikiEntry[]
  folders: HiveWikiFolder[]
  depth: number
  onOpenEntry: (id: string) => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const childFolders = folders.filter(f => f.parentId === folder.id)
  const childEntries = entries.filter(e => e.parentId === folder.id)

  return (
    <section style={{ paddingLeft: depth * 16 }}>
      <button
        type="button"
        onClick={() => setCollapsed(v => !v)}
        className="w-full flex items-center gap-2 py-2"
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        <Folder size={14} className="text-muted-foreground" />
        <span className="font-comfortaa font-bold text-sm">{folder.title}</span>
        <span className="text-xs text-muted-foreground">{folder.entryCount}</span>
      </button>
      {folder.description && !collapsed && (
        <p className="text-xs text-muted-foreground pl-6 pb-2">{folder.description}</p>
      )}
      {!collapsed && (
        <div className="space-y-4 pl-6">
          {childFolders.map(f => (
            <FolderNode
              key={f.id}
              folder={f}
              entries={entries}
              folders={folders}
              depth={depth + 1}
              onOpenEntry={onOpenEntry}
            />
          ))}
          {childEntries.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {childEntries.map(e => (
                <EntryCard key={e.id} entry={e} onClick={() => onOpenEntry(e.id)} />
              ))}
            </div>
          )}
          {childFolders.length === 0 && childEntries.length === 0 && (
            <div className="text-xs text-muted-foreground italic">Empty folder.</div>
          )}
        </div>
      )}
    </section>
  )
}
