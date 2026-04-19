import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react';

// Public pages
import Layout from './components/Layout';
import Home from './pages/Home';
import Browse from './pages/Browse';
import VideoDetail from './pages/VideoDetail';
import Success from './pages/Success';
import Download from './pages/Download';
import Editor from './pages/Editor';

// Admin pages
import AdminLayout from './components/admin/AdminLayout';
import Dashboard from './pages/admin/Dashboard';
import AdminVideos from './pages/admin/AdminVideos';
import AdminUpload from './pages/admin/AdminUpload';
import AdminEditVideo from './pages/admin/AdminEditVideo';
import AdminOrders from './pages/admin/AdminOrders';
import AdminSettings from './pages/admin/AdminSettings';

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
        {/* Public routes */}
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/browse" element={<Browse />} />
          <Route path="/video/:id" element={<VideoDetail />} />
          <Route path="/success" element={<Success />} />
          <Route path="/download" element={<Download />} />
        </Route>

        {/* Editor — full-screen, no public Layout wrapper */}
        <Route path="/edit/:id" element={<Editor />} />
        <Route path="/edit" element={<Editor />} />

        {/* Admin routes (auth required) */}
        <Route path="/admin" element={
          <>
            <SignedIn><AdminLayout /></SignedIn>
            <SignedOut><RedirectToSignIn /></SignedOut>
          </>
        }>
          <Route index element={<Dashboard />} />
          <Route path="videos" element={<AdminVideos />} />
          <Route path="videos/new" element={<AdminUpload />} />
          <Route path="videos/:id" element={<AdminEditVideo />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
