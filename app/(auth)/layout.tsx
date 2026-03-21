export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #f0f3fa 0%, #e8eef8 50%, #f0f5f5 100%)' }}>
      {children}
    </div>
  )
}
