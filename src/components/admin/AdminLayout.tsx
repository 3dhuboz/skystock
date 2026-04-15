import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { UserButton } from '@clerk/clerk-react';
import {
  LayoutDashboard, Film, Upload, ShoppingBag, Settings,
  Clapperboard, Menu, X, ChevronLeft, ExternalLink
} from 'lucide-react';

const NAV_ITEMS = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/admin/videos', icon: Film, label: 'Videos', end: false },
  { to: '/admin/videos/new', icon: Upload, label: 'Upload', end: true },
  { to: '/admin/orders', icon: ShoppingBag, label: 'Orders', end: false },
  { to: '/admin/settings', icon: Settings, label: 'Settings', end: true },
];

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-sky-950 flex">
      {/* Sidebar */}
      <aside className={`admin-sidebar fixed inset-y-0 left-0 z-40 w-64 transform transition-transform duration-200 lg:translate-x-0 lg:relative ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="h-full flex flex-col">
          {/* Logo */}
          <div className="p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-sky-500 to-ember-500 flex items-center justify-center">
                <Clapperboard className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="font-display font-bold text-white">SkyStock</span>
                <span className="block text-[10px] font-mono text-sky-500 uppercase tracking-widest">Admin Panel</span>
              </div>
            </div>
            <button className="lg:hidden text-sky-500 hover:text-white" onClick={() => setSidebarOpen(false)}>
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-display font-medium transition-all ${
                    isActive
                      ? 'bg-sky-800/50 text-white border border-sky-700/30'
                      : 'text-sky-400 hover:text-sky-200 hover:bg-sky-800/20'
                  }`
                }
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Bottom */}
          <div className="p-4 border-t border-sky-800/30 space-y-3">
            <a
              href="/"
              target="_blank"
              className="flex items-center gap-2 text-sm text-sky-500 hover:text-sky-300 transition-colors px-4 py-2"
            >
              <ExternalLink className="w-4 h-4" /> View Store
            </a>
            <div className="px-4 py-2 flex items-center gap-3">
              <UserButton afterSignOutUrl="/" />
              <span className="text-xs text-sky-500">Admin</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-sky-950/60 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen lg:min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-sky-950/80 backdrop-blur-xl border-b border-sky-700/15 px-4 lg:px-8 h-14 flex items-center gap-4">
          <button className="lg:hidden text-sky-400 hover:text-white" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1" />
          <span className="text-xs font-mono text-sky-600">SkyStock Admin v1.0</span>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-8 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
