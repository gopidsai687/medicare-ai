import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

export function AppShell() {
  return (
    <div className="bg-animated" style={{ minHeight: '100vh' }}>
      <Sidebar />
      <div className="page-content">
        <TopBar />
        <main className="page-body">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
