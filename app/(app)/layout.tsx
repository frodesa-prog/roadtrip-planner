import NavBar from '@/components/NavBar'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-screen bg-slate-950">
      <NavBar />
      {/* pb-16 på mobil gir plass til den faste bottom tab bar-en */}
      <div className="flex-1 overflow-hidden pb-16 md:pb-0">
        {children}
      </div>
    </div>
  )
}
