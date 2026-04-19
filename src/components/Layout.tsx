import { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Menu, X, Clapperboard, Search, LogIn, Shield } from 'lucide-react';
import { SignedIn, SignedOut, UserButton } from '@clerk/clerk-react';
import { useIsAdmin } from '../lib/admin';

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { isAdmin } = useIsAdmin();

  const navLinks = [
    { to: '/', label: 'Home' },
    { to: '/browse', label: 'Browse Footage' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-sky-950 grain-overlay relative">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-sky-950/80 backdrop-blur-xl border-b border-sky-700/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-sky-500 to-ember-500 flex items-center justify-center transition-transform group-hover:scale-110">
                <Clapperboard className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="font-display font-bold text-lg text-white tracking-tight">SkyStock</span>
                <span className="font-display font-light text-xs text-ember-400 ml-1">FPV</span>
              </div>
            </Link>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-8">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`font-display text-sm font-medium transition-colors ${
                    location.pathname === link.to
                      ? 'text-white'
                      : 'text-sky-400 hover:text-white'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <Link
                to="/browse"
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-800/40 border border-sky-700/30 text-sky-300 text-sm hover:bg-sky-800/60 transition-colors"
              >
                <Search className="w-4 h-4" />
                Search clips...
              </Link>

              <SignedIn>
                <Link
                  to="/account"
                  className={`font-display text-sm font-medium transition-colors ${
                    location.pathname === '/account' ? 'text-white' : 'text-sky-400 hover:text-white'
                  }`}
                >
                  My Edits
                </Link>
                {isAdmin && (
                  <Link
                    to="/admin"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-ember-400/40 bg-ember-500/10 text-ember-300 text-xs font-display font-semibold hover:bg-ember-500/20 transition-colors"
                  >
                    <Shield className="w-3.5 h-3.5" /> Admin
                  </Link>
                )}
                <UserButton afterSignOutUrl="/" appearance={{ variables: { colorPrimary: '#f97316' } }} />
              </SignedIn>
              <SignedOut>
                <Link
                  to="/sign-in"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-display font-semibold text-white transition-all hover:scale-[1.02]"
                  style={{
                    background: 'linear-gradient(135deg, #38bdf8, #f97316)',
                    boxShadow: '0 8px 24px -8px rgba(249,115,22,0.4)',
                  }}
                >
                  <LogIn className="w-4 h-4" />
                  Sign in
                </Link>
              </SignedOut>
            </div>

            {/* Mobile menu button */}
            <button
              className="md:hidden p-2 text-sky-400 hover:text-white"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <div className="md:hidden bg-sky-900/95 backdrop-blur-xl border-b border-sky-700/20 animate-fade-in">
            <div className="px-4 py-4 space-y-3">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileOpen(false)}
                  className="block py-2 font-display text-sm text-sky-200 hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Main content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-sky-700/15 bg-sky-950/80 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-ember-500 flex items-center justify-center">
                  <Clapperboard className="w-4 h-4 text-white" />
                </div>
                <span className="font-display font-bold text-white">SkyStock FPV</span>
              </div>
              <p className="text-sm text-sky-500 leading-relaxed">
                Premium 360° FPV drone footage captured across Central Queensland.
                Shot on the DJI Avata 360 — reframe every angle in post.
              </p>
            </div>
            <div>
              <h4 className="font-display font-semibold text-sky-200 mb-3">Quick Links</h4>
              <div className="space-y-2">
                <Link to="/browse" className="block text-sm text-sky-500 hover:text-sky-300 transition-colors">Browse Footage</Link>
                <a href="mailto:contact@skystock.com" className="block text-sm text-sky-500 hover:text-sky-300 transition-colors">Contact</a>
              </div>
            </div>
            <div>
              <h4 className="font-display font-semibold text-sky-200 mb-3">License</h4>
              <p className="text-sm text-sky-500 leading-relaxed">
                All footage is royalty-free for commercial and personal use.
                One-time purchase, unlimited projects.
              </p>
            </div>
          </div>
          <div className="border-t border-sky-800/40 mt-8 pt-6 text-center">
            <p className="text-xs text-sky-600">
              &copy; {new Date().getFullYear()} SkyStock FPV. All footage rights reserved. Shot in Central QLD, Australia.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
