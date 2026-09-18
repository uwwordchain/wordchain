import { AdminNav } from '@/components/admin/AdminNav'
import { Topbar } from '@/components/ui/Topbar'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="screen">
      <Topbar title="Admin Panel" showMenu isLoggedIn isAdmin />
      <main style={{ flex: 1, paddingBottom: 72 }}>
        {children}
      </main>
      <AdminNav />
    </div>
  )
}
