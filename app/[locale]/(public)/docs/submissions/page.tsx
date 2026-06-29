import { LegalPage, LegalSection } from '../../_components/legal-page'
import { BackLink } from './back-link'

export const metadata = { title: 'Submissions · Beehive Books Docs' }

export default function SubmissionsDocsPage() {
  return (
    <LegalPage title="Submissions" updated="How chapter submissions work in a Hive" preHeader={<BackLink />}>
      <LegalSection heading="What submissions are">
        <p>
          Submissions are how a contributor proposes a new chapter for someone
          else&apos;s book. The book&apos;s author keeps editorial control:
          contributors draft, owners and moderators review, and only an approved
          draft lands in the book as a real chapter.
        </p>
        <p>
          This is the only sanctioned path for a non-author to add a chapter.
          Direct edits to chapters in the book are reserved for the book&apos;s
          author.
        </p>
      </LegalSection>

      <LegalSection heading="Who can do what">
        <ul>
          <li>
            <strong>Contributors</strong> draft and submit chapters. They use a
            full rich-text editor inside the hive&apos;s submissions area and
            can choose where in the book a new chapter should be inserted.
          </li>
          <li>
            <strong>Owners</strong> and <strong>moderators</strong> review
            pending submissions. They can approve (which creates the chapter)
            or reject (which sends it back with a note).
          </li>
          <li>
            <strong>Owners</strong> who are the book&apos;s author don&apos;t
            submit chapters to their own book. They write directly in the
            studio editor. Submissions exist for the contributors they invite.
          </li>
          <li>
            <strong>Beta readers</strong> don&apos;t draft or review
            submissions. Their role is annotations and suggestions on existing
            chapters.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="Lifecycle">
        <p>A submission moves through four states:</p>
        <ul>
          <li>
            <strong>Draft</strong> — the contributor is still working on it.
            Autosaves on every keystroke. Only the contributor sees it.
          </li>
          <li>
            <strong>Pending</strong> — submitted for review. Owners and
            moderators get notified.
          </li>
          <li>
            <strong>Approved</strong> — a reviewer accepted it. A new chapter
            row is added to the book at the requested position, authored by
            the contributor. The chapter appears in the book&apos;s binder and
            on the public reader with a &quot;Written by @contributor&quot; sub-byline.
          </li>
          <li>
            <strong>Rejected</strong> — a reviewer turned it down with a note.
            No chapter is created. The contributor can read the note and start
            a new draft.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="What approval actually does">
        <p>
          Approving a submission is a privileged action that writes directly
          to the book. The system inserts a binder item and a chapter row in
          the same transaction, shifting any siblings if a target position
          was set. The chapter&apos;s author field is recorded as the
          contributor, not the reviewer, so credit follows the writing.
        </p>
        <p>
          A &quot;chapter approved&quot; event fires into the hive&apos;s activity feed and
          the contributor&apos;s community feed.
        </p>
      </LegalSection>

      <LegalSection heading="Rejection">
        <p>
          Rejecting requires a review note. The submission is preserved in the
          contributor&apos;s history with the note attached, so they know what
          to change. They can&apos;t edit a rejected submission, but they can
          start a fresh draft using what they learned.
        </p>
      </LegalSection>

      <LegalSection heading="Where it shows up">
        <p>
          Every submission lives at <code>/hive/[hiveId]/submissions</code>.
          Contributors see their own drafts and submissions. Reviewers
          additionally see every pending and reviewed submission in the hive.
          Approved submissions surface as real chapters in the book&apos;s
          binder and, once their status is set to Revised or Final, on the
          public reader.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
