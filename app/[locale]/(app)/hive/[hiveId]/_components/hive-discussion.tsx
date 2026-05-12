'use client'

import { useState } from 'react'
import type { DiscussionPost } from '@/lib/actions/hive-content.actions'
import { createDiscussionPostAction, deleteDiscussionPostAction } from '@/lib/actions/hive-content.actions'

type Props = { hiveId: string; initialPosts: DiscussionPost[]; currentUserId: string }

export function HiveDiscussion({ hiveId, initialPosts, currentUserId }: Props) {
  const [posts, setPosts] = useState(initialPosts)
  const [newPost, setNewPost] = useState('')
  const [replyTo, setReplyTo] = useState<string | null>(null)

  const topLevel = posts.filter(p => !p.parentId)
  const replies = (parentId: string) => posts.filter(p => p.parentId === parentId)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!newPost.trim()) return
    const result = await createDiscussionPostAction(hiveId, newPost.trim(), replyTo ?? undefined)
    if (result.success) {
      const newItem: DiscussionPost = {
        id: result.data.postId,
        hiveId,
        authorId: currentUserId,
        content: newPost.trim(),
        parentId: replyTo,
        createdAt: new Date(),
        author: { name: 'You', image: null },
      }
      setPosts(prev => [newItem, ...prev])
      setNewPost('')
      setReplyTo(null)
    }
  }

  async function handleDelete(postId: string) {
    await deleteDiscussionPostAction(postId)
    setPosts(prev => prev.filter(p => p.id !== postId))
  }

  return (
    <div className="max-w-2xl mx-auto p-6 flex flex-col gap-4">
      <h2 className="text-sm font-medium text-foreground">Discussion</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        {replyTo && (
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            Replying to post <button type="button" onClick={() => setReplyTo(null)} className="text-brand">✕ Cancel</button>
          </div>
        )}
        <textarea
          value={newPost}
          onChange={e => setNewPost(e.target.value)}
          placeholder={replyTo ? 'Write a reply…' : 'Start a discussion…'}
          className="resize-none bg-surface-inset border border-border rounded-md p-3 text-sm text-foreground/80 outline-none focus:border-brand/40 min-h-20"
        />
        <button type="submit" disabled={!newPost.trim()} className="self-end text-xs px-3 py-1.5 rounded bg-brand text-black font-medium disabled:opacity-40">
          Post
        </button>
      </form>

      <div className="flex flex-col gap-3">
        {topLevel.map(post => (
          <div key={post.id} className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium text-foreground">{post.author.name ?? 'Unknown'}</span>
              <span className="text-xs text-muted-foreground">{new Date(post.createdAt).toLocaleDateString()}</span>
              <div className="ml-auto flex gap-2">
                <button onClick={() => setReplyTo(post.id)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Reply</button>
                {post.authorId === currentUserId && (
                  <button onClick={() => handleDelete(post.id)} className="text-xs text-muted-foreground hover:text-destructive transition-colors">Delete</button>
                )}
              </div>
            </div>
            <p className="text-sm text-foreground/80 leading-relaxed">{post.content}</p>
            {replies(post.id).map(reply => (
              <div key={reply.id} className="mt-3 ml-4 pl-3 border-l border-border">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-foreground">{reply.author.name ?? 'Unknown'}</span>
                  <span className="text-xs text-muted-foreground">{new Date(reply.createdAt).toLocaleDateString()}</span>
                  {reply.authorId === currentUserId && (
                    <button onClick={() => handleDelete(reply.id)} className="ml-auto text-xs text-muted-foreground hover:text-destructive transition-colors">Delete</button>
                  )}
                </div>
                <p className="text-sm text-foreground/80">{reply.content}</p>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
