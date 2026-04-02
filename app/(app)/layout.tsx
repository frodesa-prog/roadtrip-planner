import AppShell from '@/components/AppShell'
import { ChatProvider } from '@/components/chat/ChatContext'
import ChatPanel from '@/components/chat/ChatPanel'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ChatProvider>
      <AppShell>{children}</AppShell>
      {/* ChatPanel is fixed-position, overlays from the right */}
      <ChatPanel />
    </ChatProvider>
  )
}
