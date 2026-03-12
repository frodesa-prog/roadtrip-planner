import NavBar from '@/components/NavBar'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-screen bg-slate-950">
      <NavBar />
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  )
}
