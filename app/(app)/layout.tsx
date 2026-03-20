import NavBar from '@/components/NavBar'
import { ChatProvider } from '@/components/chat/ChatContext'
import ChatPanel from '@/components/chat/ChatPanel'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ChatProvider>
      <div className="flex flex-col h-screen bg-[hsl(var(--page-bg))]">
        <NavBar />
        {/* pb-16 på mobil gir plass til den faste bottom tab bar-en */}
        <div className="flex-1 overflow-hidden pb-16 md:pb-0">
          {children}
        </div>
      </div>
      {/* ChatPanel is fixed-position, overlays from the right */}
      <ChatPanel />
    </ChatProvider>
  )
}
