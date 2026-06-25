import { listSupportMessagesAction } from '@/lib/actions/support.actions'
import { SupportInbox } from './_components/support-inbox'

export default async function SupportAdminPage() {
  const result = await listSupportMessagesAction()
  const messages = result.ok && result.data ? result.data : []
  return <SupportInbox initialMessages={messages} />
}
