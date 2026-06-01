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
          <div
            className="text-xs uppercase tracking-wide py-2"
            style={{ color: 'var(--canvas-dark-ink-muted)' }}
          >
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
        <div
          className="text-center text-sm py-12"
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
        >
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
        style={{
          background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
          borderRadius: 'var(--r-row)',
          boxShadow: 'var(--sh-tile)',
        }}
        className="w-full flex items-center gap-3 px-4 py-3"
      >
        {collapsed ? (
          <ChevronRight size={14} style={{ color: 'var(--canvas-dark-ink-muted)' }} />
        ) : (
          <ChevronDown size={14} style={{ color: 'var(--canvas-dark-ink-muted)' }} />
        )}
        <Folder size={14} style={{ color: 'var(--canvas-dark-ink-muted)' }} />
        <span
          className="font-comfortaa font-semibold text-sm"
          style={{ color: 'var(--canvas-dark-ink-strong)' }}
        >
          {folder.title}
        </span>
        <span
          className="ml-auto text-xs font-mono"
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
        >
          {folder.entryCount}
        </span>
      </button>
      {folder.description && !collapsed && (
        <p
          className="text-xs pl-6 py-2"
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
        >
          {folder.description}
        </p>
      )}
      {!collapsed && (
        <div className="space-y-4 pl-6 mt-3">
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
            <div
              className="text-xs italic"
              style={{ color: 'var(--canvas-dark-ink-muted)' }}
            >
              Empty folder.
            </div>
          )}
        </div>
      )}
    </section>
  )
}
