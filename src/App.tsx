import { lazy, Suspense, ComponentType, LazyExoticComponent } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react';
import { Loader2 } from 'lucide-react';
import { useIsAdmin } from './lib/admin';
import { useIsSeller } from './lib/seller';

/**
 * Wraps React.lazy with a one-shot auto-reload if the dynamic import fails.
 * When a deploy ships new chunk hashes, visitors with the previous app shell
 * cached will get "Failed to fetch dynamically imported module" trying to
 * pull the old chunk URL. Rather than crash into the error boundary, we
 * reload once — sessionStorage prevents an infinite reload loop.
 */
function lazyWithReload<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  key: string
): LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      return await factory();
    } catch (err) {
      const flag = `__reloaded_${key}`;
      if (typeof sessionStorage !== 'undefined' && !sessionStorage.getItem(flag)) {
        sessionStorage.setItem(flag, '1');
        window.location.reload();
        // Never resolves; keep Suspense in flight until the reload takes over.
        await new Promise(() => {});
      }
      throw err;
    }
  });
}

// Public pages
import Layout from './components/Layout';
import Home from './pages/Home';
import Browse from './pages/Browse';
import VideoDetail from './pages/VideoDetail';
import Success from './pages/Success';
import Download from './pages/Download';
import SignInPage from './pages/SignInPage';
import Account from './pages/Account';
import SellerApply from './pages/SellerApply';
import SellerClips from './pages/SellerClips';
import SellerUpload from './pages/SellerUpload';
import SellerProfile from './pages/SellerProfile';

// Editor is ~500KB (Three.js) — only load on /edit/* routes
const Editor = lazyWithReload(() => import('./pages/Editor'), 'editor');

function EditorFallback() {
  return (
    <div className="fixed inset-0 bg-[#0a0e1a] flex items-center justify-center text-sky-400 text-sm">
      <Loader2 className="w-5 h-5 animate-spin mr-3" />
      Loading editor…
    </div>
  );
}

function AdminGate({ children }: { children: React.ReactNode }) {
  const { isAdmin, isLoaded } = useIsAdmin();
  if (!isLoaded) {
    return (
      <div className="fixed inset-0 bg-[#0a0e1a] flex items-center justify-center text-sky-400 text-sm">
        <Loader2 className="w-5 h-5 animate-spin mr-3" />
        Checking access…
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/account" replace />;
  return <>{children}</>;
}

/** Gates /seller/* routes. Admins always pass through (they can test the
 *  seller experience); otherwise the user must have the 'seller' role. */
function SellerGate({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useIsAdmin();
  const { isSeller, isLoaded } = useIsSeller();
  if (!isLoaded) {
    return (
      <div className="fixed inset-0 bg-[#0a0e1a] flex items-center justify-center text-sky-400 text-sm">
        <Loader2 className="w-5 h-5 animate-spin mr-3" />
        Checking access…
      </div>
    );
  }
  if (!isSeller && !isAdmin) return <Navigate to="/seller/apply" replace />;
  return <>{children}</>;
}

// Admin pages
import AdminLayout from './components/admin/AdminLayout';
import Dashboard from './pages/admin/Dashboard';
import AdminVideos from './pages/admin/AdminVideos';
import AdminUpload from './pages/admin/AdminUpload';
import AdminEditVideo from './pages/admin/AdminEditVideo';
import AdminOrders from './pages/admin/AdminOrders';
import AdminSettings from './pages/admin/AdminSettings';
import AdminModeration from './pages/admin/AdminModeration';

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#141d36',
            color: '#e8edf5',
            border: '1px solid rgba(59, 108, 181, 0.3)',
            borderRadius: '12px',
            fontFamily: '"DM Sans", sans-serif',
          },
          success: {
            iconTheme: { primary: '#10b981', secondary: '#141d36' },
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: '#141d36' },
          },
        }}
      />
      <Routes>
        {/* Auth — full-screen, no Layout wrapper */}
        <Route path="/sign-in/*" element={<SignInPage />} />
        <Route path="/sign-up/*" element={<SignInPage />} />

        {/* Account — auth required, full-screen */}
        <Route path="/account" element={
          <>
            <SignedIn><Account /></SignedIn>
            <SignedOut><RedirectToSignIn /></SignedOut>
          </>
        } />

        {/* Seller apply — visible to signed-in users, regardless of seller role */}
        <Route path="/seller/apply" element={
          <>
            <SignedIn><SellerApply /></SignedIn>
            <SignedOut><SellerApply /></SignedOut>
          </>
        } />

        {/* Seller workspace — approved sellers only (admins pass) */}
        <Route path="/seller/clips" element={
          <>
            <SignedIn><SellerGate><SellerClips /></SellerGate></SignedIn>
            <SignedOut><RedirectToSignIn /></SignedOut>
          </>
        } />
        <Route path="/seller/upload" element={
          <>
            <SignedIn><SellerGate><SellerUpload /></SellerGate></SignedIn>
            <SignedOut><RedirectToSignIn /></SignedOut>
          </>
        } />

        {/* Public routes */}
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/browse" element={<Browse />} />
          <Route path="/video/:id" element={<VideoDetail />} />
          <Route path="/s/:id" element={<SellerProfile />} />
          <Route path="/success" element={<Success />} />
          <Route path="/download" element={<Download />} />
        </Route>

        {/* Editor — full-screen, no public Layout wrapper. Lazy-loaded. */}
        <Route path="/edit/:id" element={
          <Suspense fallback={<EditorFallback />}><Editor /></Suspense>
        } />
        <Route path="/edit" element={
          <Suspense fallback={<EditorFallback />}><Editor /></Suspense>
        } />

        {/* Admin routes (auth + admin allow-list) */}
        <Route path="/admin" element={
          <>
            <SignedIn><AdminGate><AdminLayout /></AdminGate></SignedIn>
            <SignedOut><RedirectToSignIn /></SignedOut>
          </>
        }>
          <Route index element={<Dashboard />} />
          <Route path="videos" element={<AdminVideos />} />
          <Route path="videos/new" element={<AdminUpload />} />
          <Route path="videos/:id" element={<AdminEditVideo />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="moderation" element={<AdminModeration />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
