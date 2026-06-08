import { Fragment } from 'react'
import { MentionLink } from './mention-link'

type Props = { text: string }

const MENTION_REGEX = /(@[a-z0-9_]{3,20})/gi

export function RenderMentionsInText({ text }: Props) {
  if (!text) return null
  const parts = text.split(MENTION_REGEX)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('@')) {
          const username = part.slice(1).toLowerCase()
          return <MentionLink key={i} username={username} />
        }
        return <Fragment key={i}>{part}</Fragment>
      })}
    </>
  )
}
